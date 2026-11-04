import { test, expect } from "@playwright/test";

/** Mobile checks: no horizontal scroll, menu usable, key pages render, 404, a11y basics. */
const pages = ["/", "/shop", "/brands", "/cart", "/checkout", "/orders/track", "/faq", "/policies/envios", "/login"];

for (const path of pages) {
  test(`móvil sin scroll horizontal: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator("h1").first()).toBeVisible();
    // every image has an alt attribute (decorative ones use alt="")
    expect(await page.locator("img:not([alt])").count()).toBe(0);
    // every form control has an accessible name
    const unnamed = await page.locator("input:not([type=hidden]), select, textarea").evaluateAll((els) =>
      els.filter((el) => {
        const id = el.getAttribute("id");
        return !el.getAttribute("aria-label") && !(id && document.querySelector(`label[for="${id}"]`)) && !el.closest("label");
      }).length,
    );
    expect(unnamed).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("menú móvil abre y navega", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /menú/i }).first().click();
  const link = page.getByRole("dialog").getByRole("link", { name: "SNEAKERS", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/sneakers$/);
});

test("404 propia", async ({ page }) => {
  const res = await page.goto("/no-existe-esta-pagina");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toBeVisible();
});

test("producto inexistente responde 404", async ({ page }) => {
  const res = await page.goto("/product/no-existe-xyz");
  expect(res?.status()).toBe(404);
});
