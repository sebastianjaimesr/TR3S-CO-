"use server";
import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";
import { normalizeWhatsappNumber } from "@/services/whatsapp";
import { bool, dbError, done, fail, int, optStr, refreshCatalog, str } from "@/features/admin/actions/common";

/* ------------------------------- Brands -------------------------------- */
export async function saveBrand(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const id = str(form, "id");
  let logo_url = optStr(form, "logo_url");
  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024 || !["image/png", "image/svg+xml", "image/webp"].includes(file.type)) fail("/admin/brands", "Logo: PNG, SVG o WEBP de máximo 2 MB.");
    const path = `${crypto.randomUUID()}.${file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1]}`;
    const { error } = await staff.sb.storage.from("brands").upload(path, file, { contentType: file.type });
    if (error) fail("/admin/brands", error.message);
    logo_url = staff.sb.storage.from("brands").getPublicUrl(path).data.publicUrl;
  }
  const row = {
    name: str(form, "name"),
    slug: str(form, "slug") || slugify(str(form, "name")),
    description: optStr(form, "description"),
    is_active: bool(form, "is_active"),
    ...(logo_url ? { logo_url } : {}),
  };
  if (!row.name) fail("/admin/brands", "El nombre es obligatorio.");
  const { error } = id ? await staff.sb.from("brands").update(row).eq("id", id) : await staff.sb.from("brands").insert(row);
  if (error) fail("/admin/brands", dbError(error.message));
  refreshCatalog();
  done("/admin/brands", "Marca guardada.");
}

/* ------------------------------ Suppliers ------------------------------ */
export async function saveSupplier(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const id = str(form, "id");
  const row = {
    name: str(form, "name"),
    legal_name: optStr(form, "legal_name"),
    tax_id: optStr(form, "tax_id"),
    contact_name: optStr(form, "contact_name"),
    phone: optStr(form, "phone"),
    email: optStr(form, "email"),
    city: optStr(form, "city"),
    conditions: optStr(form, "conditions"),
    catalog_url: optStr(form, "catalog_url"),
    notes: optStr(form, "notes"),
    is_active: id ? bool(form, "is_active") : true,
  };
  if (!row.name) fail("/admin/suppliers", "El nombre es obligatorio.");
  if (id) {
    const { error } = await staff.sb.from("suppliers").update(row).eq("id", id);
    if (error) fail(`/admin/suppliers/${id}`, dbError(error.message));
    refreshCatalog();
    done(`/admin/suppliers/${id}`, "Proveedor guardado.");
  }
  const { data, error } = await staff.sb.from("suppliers").insert(row).select("id").single();
  if (error) fail("/admin/suppliers", dbError(error.message));
  done(`/admin/suppliers/${data.id}`, "Proveedor creado. Ahora vincula las referencias que ofrece.");
}

/** Links a variant (by SKU) to a supplier with cost, reported quantity and lead time. */
export async function linkSupplierVariant(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const supplierId = str(form, "supplier_id");
  const back = `/admin/suppliers/${supplierId}`;
  const sku = str(form, "sku").toUpperCase();
  const { data: v } = await staff.sb.from("product_variants").select("id").eq("sku", sku).maybeSingle();
  if (!v) fail(back, `No existe una variante con SKU ${sku}. Créala primero en Productos.`);
  const qty = int(form, "quantity_reported") ?? 0;
  const { data: row, error } = await staff.sb
    .from("supplier_stock")
    .upsert(
      {
        supplier_id: supplierId,
        variant_id: v.id,
        supplier_sku: optStr(form, "supplier_sku"),
        supplier_cost: int(form, "supplier_cost") ?? 0,
        quantity_reported: qty,
        is_available: qty > 0,
        lead_time_days: int(form, "lead_time_days") ?? 5,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "supplier_id,variant_id" },
    )
    .select("id")
    .single();
  if (error) fail(back, dbError(error.message));
  // history entry through the audited function
  await staff.sb.rpc("confirm_supplier_stock", { p_supplier_stock_id: row.id, p_quantity: qty, p_available: qty > 0, p_notes: "Alta / actualización desde catálogo del proveedor" });
  refreshCatalog();
  done(back, `SKU ${sku} vinculado.`);
}

export async function confirmSupplierStock(form: FormData) {
  const staff = await requireStaff(["inventory", "sales"]);
  const supplierId = str(form, "supplier_id");
  const qty = int(form, "quantity") ?? 0;
  const { error } = await staff.sb.rpc("confirm_supplier_stock", {
    p_supplier_stock_id: str(form, "supplier_stock_id"),
    p_quantity: qty,
    p_available: qty > 0 && str(form, "available") !== "no",
    p_lead_time_days: int(form, "lead_time_days"),
    p_supplier_cost: int(form, "supplier_cost"),
    p_notes: optStr(form, "notes"),
  });
  if (error) fail(`/admin/suppliers/${supplierId}`, dbError(error.message));
  refreshCatalog();
  done(`/admin/suppliers/${supplierId}`, "Disponibilidad confirmada.");
}

/* ------------------------------ Inventory ------------------------------ */
export async function moveInventory(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const sku = str(form, "sku").toUpperCase();
  const { data: v } = await staff.sb.from("product_variants").select("id").eq("sku", sku).maybeSingle();
  if (!v) fail("/admin/inventory", `No existe el SKU ${sku}.`);
  const qty = int(form, "quantity");
  if (!qty) fail("/admin/inventory", "Cantidad inválida.");
  const { error } = await staff.sb.rpc("adjust_inventory", {
    p_variant_id: v.id,
    p_location: str(form, "location") || "bodega-principal",
    p_type: str(form, "type"),
    p_quantity: qty,
    p_unit_cost: int(form, "unit_cost"),
    p_note: optStr(form, "note"),
  });
  if (error) fail("/admin/inventory", error.message.includes("check constraint") ? "No hay suficientes unidades libres para esa salida (revisa reservas)." : dbError(error.message));
  refreshCatalog();
  done("/admin/inventory", `Movimiento registrado para ${sku}.`);
}

/* ------------------------------ Customers ------------------------------ */
export async function saveCustomerNotes(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "id");
  const { error } = await staff.sb.from("customers").update({ notes: optStr(form, "notes"), phone: str(form, "phone") }).eq("id", id);
  if (error) fail(`/admin/customers/${id}`, dbError(error.message));
  done(`/admin/customers/${id}`, "Cliente actualizado.");
}

/* ------------------------------ Campaigns ------------------------------ */
export async function saveCampaign(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const id = str(form, "id");
  const refs = str(form, "products").split(/[\s,]+/).filter(Boolean);
  let productIds: string[] = [];
  if (refs.length) {
    const { data } = await staff.sb.from("products").select("id, slug, reference").or(`slug.in.(${refs.join(",")}),reference.in.(${refs.join(",")})`);
    productIds = refs.map((r) => data?.find((p) => p.slug === r || p.reference === r)?.id).filter((x): x is string => Boolean(x));
    if (productIds.length !== refs.length) fail("/admin/campaigns", "Algún slug o referencia de producto no existe.");
  }
  let fallback = optStr(form, "fallback_image_url");
  const file = form.get("fallback_image");
  if (file instanceof File && file.size > 0) {
    const path = `${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const { error } = await staff.sb.storage.from("campaigns").upload(path, file, { contentType: file.type });
    if (error) fail("/admin/campaigns", error.message);
    fallback = staff.sb.storage.from("campaigns").getPublicUrl(path).data.publicUrl;
  }
  const lines = (k: string) => str(form, k).split("\n").map((s) => s.trim()).filter(Boolean);
  const row = {
    name: str(form, "name") || "Campaña",
    headline: lines("headline").length ? lines("headline") : ["YOUR STYLE.", "YOUR MOVE."],
    subheadline: str(form, "subheadline") || "FIND YOUR NEXT STEP.",
    monumental_words: str(form, "monumental_words").split(/[,\s]+/).filter(Boolean).map((w) => w.toUpperCase()),
    product_ids: productIds,
    fallback_image_url: fallback,
    model_url: optStr(form, "model_url"),
    banner_image_url: optStr(form, "banner_image_url"),
    banner_link: optStr(form, "banner_link"),
    is_active: bool(form, "is_active"),
    starts_at: optStr(form, "starts_at"),
    ends_at: optStr(form, "ends_at"),
  };
  if (row.is_active) await staff.sb.from("homepage_campaigns").update({ is_active: false }).neq("id", id || "00000000-0000-0000-0000-000000000000");
  const { error } = id ? await staff.sb.from("homepage_campaigns").update(row).eq("id", id) : await staff.sb.from("homepage_campaigns").insert(row);
  if (error) fail("/admin/campaigns", dbError(error.message));
  refreshCatalog();
  done("/admin/campaigns", "Campaña guardada.");
}

/* ------------------------------- Settings ------------------------------ */
export async function saveSettings(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const rawWa = str(form, "whatsapp_number");
  const wa = rawWa ? normalizeWhatsappNumber(rawWa) : null;
  if (rawWa && !wa) fail("/admin/settings", "Número de WhatsApp inválido. Usa formato 573001234567.");
  const { error } = await staff.sb
    .from("store_settings")
    .update({
      whatsapp_number: wa,
      shipping_flat_rate: int(form, "shipping_flat_rate") ?? 0,
      free_shipping_from: int(form, "free_shipping_from"),
      bank_transfer_instructions: optStr(form, "bank_transfer_instructions"),
      payment_wompi_enabled: bool(form, "payment_wompi_enabled"),
      payment_transfer_enabled: bool(form, "payment_transfer_enabled"),
      supplier_confirmation_max_age_days: int(form, "supplier_confirmation_max_age_days") ?? 7,
      low_stock_threshold: int(form, "low_stock_threshold") ?? 2,
      contact_email: optStr(form, "contact_email"),
      contact_phone: optStr(form, "contact_phone"),
      address: optStr(form, "address"),
      instagram_url: optStr(form, "instagram_url"),
      tiktok_url: optStr(form, "tiktok_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) fail("/admin/settings", dbError(error.message));
  refreshCatalog();
  done("/admin/settings", "Configuración guardada.");
}

export async function grantRole(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role");
  const svc = supabaseService();
  if (!svc) fail("/admin/settings", "Falta SUPABASE_SERVICE_ROLE_KEY para buscar usuarios.");
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) fail("/admin/settings", "Ese correo no tiene cuenta. Pídele que se registre en /login primero.");
  const { error } = await staff.sb.from("user_roles").insert({ user_id: user.id, role_id: role });
  if (error) fail("/admin/settings", dbError(error.message));
  done("/admin/settings", `Rol ${role} asignado a ${email}.`);
}

export async function revokeRole(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const userId = str(form, "user_id");
  if (userId === staff.userId && str(form, "role") === "admin") fail("/admin/settings", "No puedes quitarte tu propio rol de administrador.");
  const { error } = await staff.sb.from("user_roles").delete().eq("user_id", userId).eq("role_id", str(form, "role"));
  if (error) fail("/admin/settings", dbError(error.message));
  done("/admin/settings", "Rol revocado.");
}
