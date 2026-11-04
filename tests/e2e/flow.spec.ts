import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Full business flow against a real local stack (next start + local Supabase):
 * admin sets up a catalog → customer buys own stock by transfer → staff confirms,
 * ships and delivers → customer tracks; then a supplier ("bajo pedido") item is
 * bought through Wompi and confirmed by a signed webhook.
 */
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET ?? "test_events_localfake";
const run = Date.now().toString(36).toUpperCase();
const admin = { email: `admin.${run.toLowerCase()}@e2e.test`, password: "Admin-e2e-2026" };
const customerEmail = `cliente.${run.toLowerCase()}@e2e.test`;
const ref = `E2E${run}`;
const brandName = `Marca E2E ${run}`;
const productName = `Tenis E2E ${run}`;

const sql = (q: string) => execFileSync("psql", [DB, "-tAc", q], { encoding: "utf8" }).trim();
const formWith = (page: Page, button: string) =>
  page.locator("form").filter({ has: page.getByRole("button", { name: button, exact: true }) }).first();
const okFlash = (page: Page) => expect(page.getByRole("status").filter({ hasText: /./ }).first()).toBeVisible();

test.describe.configure({ mode: "serial" });

let productSlug = "";
let transferOrder = "";

test("admin: cuenta, rol y configuración", async ({ page }) => {
  await page.goto("/login?next=/account");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Correo").fill(admin.email);
  await page.getByLabel("Contraseña").fill(admin.password);
  await page.getByRole("button", { name: "Crear cuenta" }).last().click();
  await page.waitForURL((u) => u.pathname === "/account");

  // Without a role, /admin is closed
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();

  sql(`insert into user_roles (user_id, role_id) select id, 'admin' from auth.users where email = '${admin.email}'`);

  await page.goto("/admin/settings");
  const f = formWith(page, "Guardar configuración");
  await f.locator('[name="whatsapp_number"]').fill("573001234567");
  await f.locator('[name="shipping_flat_rate"]').fill("15000");
  await f.locator('[name="free_shipping_from"]').fill("");
  await f.locator('[name="bank_transfer_instructions"]').fill("Bancolombia ahorros 000-000000-00 a nombre de TR3S & CO. (dato de prueba E2E)");
  await f.locator('[name="payment_transfer_enabled"]').check();
  await f.locator('[name="payment_wompi_enabled"]').check();
  await f.getByRole("button", { name: "Guardar configuración" }).click();
  await okFlash(page);
});

test("admin: marca, producto, tallas, inventario propio y proveedor", async ({ page }) => {
  await login(page);
  await page.goto("/admin/brands");
  const bf = formWith(page, "Crear marca");
  await bf.locator('[name="name"]').fill(brandName);
  await bf.getByRole("button", { name: "Crear marca" }).click();
  await okFlash(page);

  await page.goto("/admin/products/new");
  const pf = formWith(page, "Guardar producto");
  await pf.locator('[name="name"]').fill(productName);
  await pf.locator('[name="reference"]').fill(ref);
  await pf.locator('[name="brand_id"]').selectOption({ label: brandName });
  await pf.locator('[name="category_id"]').selectOption({ index: 0 });
  await pf.locator('[name="gender"]').selectOption("unisex");
  await pf.locator('[name="description"]').fill("Producto creado por la prueba E2E.");
  await pf.locator('[name="price"]').fill("350000");
  await pf.locator('[name="is_active"]').check();
  await pf.getByRole("button", { name: "Guardar producto" }).click();
  await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);
  await okFlash(page);
  productSlug = sql(`select slug from products where reference = '${ref}'`);
  expect(productSlug).toBeTruthy();

  const sf = formWith(page, "Crear variantes");
  await sf.locator('[name="color"]').fill("Negro");
  await sf.locator('[name="sizes"]').fill("40, 41");
  await sf.getByRole("button", { name: "Crear variantes" }).click();
  await expect(page.getByText("2 variantes creadas.")).toBeVisible();

  // Photo upload to Supabase Storage (tiny valid PNG generated in the test)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const uf = formWith(page, "Subir");
  await uf.locator('[name="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await uf.locator('[name="alt"]').fill(`${productName} vista lateral`);
  await uf.getByRole("button", { name: "Subir" }).click();
  await expect(page.getByText("Imagen agregada.")).toBeVisible();
  const imgUrl = sql(`select i.url from product_images i join products p on p.id = i.product_id where p.reference = '${ref}'`);
  expect(imgUrl).toContain("/storage/v1/object/public/products/");
  expect((await page.request.get(imgUrl)).ok()).toBeTruthy();

  // Own stock: 1 unit of size 40
  await page.goto("/admin/inventory");
  const inf = formWith(page, "Registrar");
  await inf.locator('[name="sku"]').fill(`${ref}-NEGRO-40`);
  await inf.locator('[name="type"]').selectOption("entry");
  await inf.locator('[name="quantity"]').fill("1");
  await inf.locator('[name="unit_cost"]').fill("200000");
  await inf.getByRole("button", { name: "Registrar" }).click();
  await okFlash(page);
  expect(sql(`select i.quantity from inventory i join product_variants v on v.id = i.variant_id where v.sku = '${ref}-NEGRO-40'`)).toBe("1");

  // Supplier stock for size 41 (on order), confirmed by staff
  await page.goto("/admin/suppliers");
  const spf = formWith(page, "Crear proveedor");
  await spf.locator('[name="name"]').fill(`Proveedor E2E ${run}`);
  await spf.locator('[name="city"]').fill("Bucaramanga");
  await spf.getByRole("button", { name: "Crear proveedor" }).click();
  await page.waitForURL(/\/admin\/suppliers\/[0-9a-f-]{36}/);
  const lf = formWith(page, "Vincular");
  await lf.locator('[name="sku"]').fill(`${ref}-NEGRO-41`);
  await lf.locator('[name="supplier_cost"]').fill("210000");
  await lf.locator('[name="quantity_reported"]').fill("3");
  await lf.getByRole("button", { name: "Vincular" }).click();
  await okFlash(page);
  await formWith(page, "OK").getByRole("button", { name: "OK" }).click();
  await okFlash(page);
  expect(sql(`select count(*) from supplier_confirmations c join supplier_stock s on s.id = c.supplier_stock_id join product_variants v on v.id = s.variant_id where v.sku = '${ref}-NEGRO-41'`)).toBe("2") // link + re-confirmation;
});

test("admin: campaña del hero con producto real", async ({ page }) => {
  await login(page);
  await page.goto("/admin/campaigns");
  const cf = formWith(page, "Crear campaña");
  await cf.locator('[name="name"]').fill(`Campaña E2E ${run}`);
  await cf.locator('[name="headline"]').fill("NUEVA\nTEMPORADA");
  await cf.locator('[name="products"]').fill(productSlug);
  await cf.locator('[name="is_active"]').check();
  await cf.getByRole("button", { name: "Crear campaña" }).click();
  await okFlash(page);

  await page.goto("/");
  await expect(page.getByText(productName).first()).toBeVisible();
  await expect(page.getByText("DEMO", { exact: false }).first()).toBeHidden().catch(() => {});
});

test("cliente: compra stock propio por transferencia", async ({ page }) => {
  await page.goto(`/product/${productSlug}`);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await expect(page.getByAltText(`${productName} vista lateral`).first()).toBeVisible();
  await page.getByRole("button", { name: "Talla 40" }).click();
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL((u) => u.pathname === "/checkout");
  await fillCheckout(page, "transfer");
  await page.waitForURL(/\/checkout\/result\?order=/);
  await expect(page.getByRole("heading", { name: /Gracias por comprar/ })).toBeVisible();
  transferOrder = new URL(page.url()).searchParams.get("order")!;
  expect(transferOrder).toMatch(/^T3-\d{6}-\d+$/);
  await expect(page.getByText("Bancolombia ahorros")).toBeVisible();

  // Stock is reserved: the last unit can't be sold twice
  expect(sql(`select i.reserved from inventory i join product_variants v on v.id = i.variant_id where v.sku = '${ref}-NEGRO-40'`)).toBe("1");
  await page.goto(`/product/${productSlug}`);
  await expect(page.getByRole("button", { name: /Talla 40, agotada/ })).toBeVisible();
});

test("staff: confirma transferencia, despacha y entrega; cliente rastrea", async ({ page, browser }) => {
  await login(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: transferOrder }).click();
  const total = sql(`select total from orders where number = '${transferOrder}'`);
  expect(total).toBe("365000");

  const pay = formWith(page, "Confirmar pago");
  await pay.locator('[name="reference"]').fill(`BANCO-${run}`);
  await pay.locator('[name="amount"]').fill(total);
  await pay.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(page.getByText(/Pago registrado/)).toBeVisible();
  expect(sql(`select status from orders where number = '${transferOrder}'`)).toBe("preparing");
  expect(sql(`select i.quantity || '/' || i.reserved from inventory i join product_variants v on v.id = i.variant_id where v.sku = '${ref}-NEGRO-40'`)).toBe("0/0");

  const ship = formWith(page, "Marcar despachado");
  await ship.locator('[name="carrier"]').fill("Servientrega");
  await ship.locator('[name="tracking"]').fill(`GUIA${run}`);
  await ship.getByRole("button", { name: "Marcar despachado" }).click();
  await expect(page.getByText("Despacho registrado.")).toBeVisible();

  const st = formWith(page, "Aplicar");
  await st.locator('[name="status"]').selectOption("delivered");
  await st.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Estado actualizado.")).toBeVisible();

  // Customer tracking in a clean context (no session)
  const ctx = await browser.newContext();
  const c = await ctx.newPage();
  await c.goto(`/orders/track?number=${transferOrder}`);
  await c.locator('[name="email"]').fill(customerEmail);
  await c.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(c.getByText("Entregado").first()).toBeVisible();
  await expect(c.getByText(`GUIA${run}`)).toBeVisible();
  // wrong email reveals nothing
  await c.goto(`/orders/track?number=${transferOrder}`);
  await c.locator('[name="email"]').fill("otra@persona.co");
  await c.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(c.getByText(`GUIA${run}`)).toHaveCount(0);
  await ctx.close();
});

test("cliente: compra bajo pedido con Wompi y webhook firmado", async ({ page, request }) => {
  let wompiUrl = "";
  await page.route("https://checkout.wompi.co/**", (route) => {
    wompiUrl = route.request().url();
    return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Wompi (simulado en la prueba)</h1>" });
  });
  await page.goto(`/product/${productSlug}`);
  await page.getByRole("button", { name: /Talla 41, bajo pedido/ }).click();
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL((u) => u.pathname === "/checkout");
  await fillCheckout(page, "wompi");
  await expect.poll(() => wompiUrl).toContain("checkout.wompi.co/p/");
  const params = new URL(wompiUrl).searchParams;
  const number = params.get("reference")!;
  const cents = Number(params.get("amount-in-cents"));
  expect(params.get("signature:integrity")).toMatch(/^[0-9a-f]{64}$/);
  expect(cents).toBe(365000 * 100);
  expect(sql(`select status from orders where number = '${number}'`)).toBe("pending_payment");

  const tx = { id: `TX-${run}`, reference: number, amount_in_cents: cents, currency: "COP", status: "APPROVED", payment_method_type: "CARD" };
  const timestamp = Math.floor(Date.now() / 1000);
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const checksum = createHash("sha256").update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${EVENTS_SECRET}`).digest("hex");
  const event = { event: "transaction.updated", data: { transaction: tx }, environment: "test", signature: { properties, checksum }, timestamp, sent_at: new Date().toISOString() };

  // forged event is rejected
  const bad = await request.post("/api/webhooks/wompi", { data: { ...event, signature: { properties, checksum: "0".repeat(64) } } });
  expect(bad.status()).toBe(401);
  expect(sql(`select status from orders where number = '${number}'`)).toBe("pending_payment");

  const res = await request.post("/api/webhooks/wompi", { data: event, headers: { "X-Event-Checksum": checksum } });
  expect(res.ok()).toBeTruthy();
  // supplier item → waits for supplier confirmation
  expect(sql(`select status from orders where number = '${number}'`)).toBe("awaiting_supplier");
  // replay is ignored
  const again = await request.post("/api/webhooks/wompi", { data: event });
  expect((await again.json()).duplicate).toBe(true);
  expect(sql(`select count(*) from payments where transaction_id = '${tx.id}'`)).toBe("1");

  // Staff confirms the supplier has it → preparing
  await login(page);
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: number }).click();
  await page.getByRole("button", { name: "Sí tiene" }).click();
  await expect(page.getByText("Confirmación del proveedor registrada.")).toBeVisible();
  // all items confirmed → the order advances to preparation by itself
  expect(sql(`select status from orders where number = '${number}'`)).toBe("preparing");
  // own stock was never touched by the supplier sale
  expect(sql(`select i.quantity from inventory i join product_variants v on v.id = i.variant_id where v.sku = '${ref}-NEGRO-40'`)).toBe("0");
});

test("auditoría registra los cambios del panel", async ({ page }) => {
  await login(page);
  await page.goto("/admin/audit");
  await expect(page.getByText(admin.email).first()).toBeVisible();
});

async function login(page: Page) {
  await page.goto("/login?next=/admin");
  await page.getByLabel("Correo").fill(admin.email);
  await page.getByLabel("Contraseña").fill(admin.password);
  await page.getByRole("button", { name: "Ingresar" }).last().click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"));
}

async function fillCheckout(page: Page, method: "transfer" | "wompi") {
  await page.locator('[name="firstName"]').fill("Laura");
  await page.locator('[name="lastName"]').fill("Prueba E2E");
  await page.locator('[name="email"]').fill(customerEmail);
  await page.locator('[name="phone"]').fill("3001234567");
  await page.locator('[name="address"]').fill("Calle 1 # 2-3");
  await page.locator(`[name="paymentMethod"][value="${method}"]`).check();
  await page.locator('[name="acceptPolicies"]').check();
  await page.locator('form button[type="submit"]').click();
}
