"use server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { bool, dbError, done, fail, int, optStr, refreshCatalog, str } from "@/features/admin/actions/common";

const productSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(140),
  reference: z.string().min(1).max(60),
  brand_id: z.string().uuid(),
  category_id: z.string().uuid(),
  gender: z.enum(["men", "women", "unisex"]),
  shoe_type: z.string().min(2).max(40),
  description: z.string().max(4000),
  materials: z.string().max(1000).nullable(),
  price: z.number().int().positive(),
  compare_at_price: z.number().int().positive().nullable(),
  is_new: z.boolean(),
  is_active: z.boolean(),
  is_demo: z.boolean(),
  model_url: z.string().url().nullable(),
  featured_rank: z.number().int().nullable(),
});

export async function saveProduct(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const id = str(form, "id");
  const back = id ? `/admin/products/${id}` : "/admin/products/new";
  const parsed = productSchema.safeParse({
    name: str(form, "name"),
    slug: str(form, "slug") || slugify(`${str(form, "name")}-${str(form, "reference")}`),
    reference: str(form, "reference"),
    brand_id: str(form, "brand_id"),
    category_id: str(form, "category_id"),
    gender: str(form, "gender"),
    shoe_type: str(form, "shoe_type") || "sneaker",
    description: str(form, "description"),
    materials: optStr(form, "materials"),
    price: int(form, "price"),
    compare_at_price: int(form, "compare_at_price"),
    is_new: bool(form, "is_new"),
    is_active: bool(form, "is_active"),
    is_demo: bool(form, "is_demo"),
    model_url: optStr(form, "model_url"),
    featured_rank: int(form, "featured_rank"),
  });
  if (!parsed.success) fail(back, `Datos inválidos: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const d = parsed.data;
  if (d.compare_at_price != null && d.compare_at_price <= d.price) fail(back, "El precio anterior debe ser mayor al precio actual (descuento real).");

  if (id) {
    const { error } = await staff.sb.from("products").update(d).eq("id", id);
    if (error) fail(back, dbError(error.message));
    refreshCatalog();
    done(back, "Producto guardado.");
  }
  const { data, error } = await staff.sb.from("products").insert(d).select("id").single();
  if (error) fail(back, dbError(error.message));
  refreshCatalog();
  done(`/admin/products/${data.id}`, "Producto creado. Agrega variantes, fotos e inventario antes de publicarlo.");
}

export async function deleteProduct(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const id = str(form, "id");
  const { error } = await staff.sb.from("products").delete().eq("id", id);
  if (error) {
    // in use by orders: deactivate instead
    await staff.sb.from("products").update({ is_active: false }).eq("id", id);
    refreshCatalog();
    fail(`/admin/products/${id}`, "El producto tiene pedidos asociados: se desactivó en lugar de eliminarse.");
  }
  refreshCatalog();
  done("/admin/products", "Producto eliminado.");
}

export async function saveVariant(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const productId = str(form, "product_id");
  const back = `/admin/products/${productId}`;
  const id = str(form, "id");
  const row = {
    product_id: productId,
    sku: str(form, "sku").toUpperCase(),
    size: str(form, "size"),
    color: str(form, "color"),
    color_hex: optStr(form, "color_hex"),
    price: int(form, "price"),
    is_active: id ? bool(form, "is_active") : true,
  };
  if (!row.sku || !row.size || !row.color) fail(back, "SKU, talla y color son obligatorios.");
  const q = id ? staff.sb.from("product_variants").update(row).eq("id", id) : staff.sb.from("product_variants").insert(row);
  const { error } = await q;
  if (error) fail(back, dbError(error.message));
  refreshCatalog();
  done(back, "Variante guardada.");
}

/** Creates one variant per size: SKU = REFERENCE-COLOR-SIZE */
export async function addSizeRun(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const productId = str(form, "product_id");
  const back = `/admin/products/${productId}`;
  const { data: p } = await staff.sb.from("products").select("reference").eq("id", productId).single();
  const color = str(form, "color");
  const sizes = str(form, "sizes").split(/[,\s]+/).filter(Boolean);
  if (!p || !color || !sizes.length) fail(back, "Indica color y tallas (ej: 38, 39, 40).");
  const colorCode = slugify(color).toUpperCase().slice(0, 6);
  const rows = sizes.map((size) => ({
    product_id: productId,
    sku: `${p.reference}-${colorCode}-${size}`.toUpperCase().replace(/[^A-Z0-9.-]/g, ""),
    size,
    color,
    color_hex: optStr(form, "color_hex"),
  }));
  const { error } = await staff.sb.from("product_variants").insert(rows);
  if (error) fail(back, dbError(error.message));
  refreshCatalog();
  done(back, `${rows.length} variantes creadas.`);
}

export async function uploadImage(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const productId = str(form, "product_id");
  const back = `/admin/products/${productId}`;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) fail(back, "Selecciona una imagen.");
  if (file.size > 5 * 1024 * 1024) fail(back, "La imagen supera 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) fail(back, "Formato no permitido (JPG, PNG, WEBP o AVIF).");
  const ext = file.type.split("/")[1];
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await staff.sb.storage.from("products").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) fail(back, `No se pudo subir: ${upErr.message}`);
  const { data: pub } = staff.sb.storage.from("products").getPublicUrl(path);
  const { count } = await staff.sb.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await staff.sb.from("product_images").insert({ product_id: productId, url: pub.publicUrl, alt: str(form, "alt"), position: count ?? 0 });
  if (error) fail(back, dbError(error.message));
  refreshCatalog();
  done(back, "Imagen agregada.");
}

export async function deleteImage(form: FormData) {
  const staff = await requireStaff(["inventory"]);
  const productId = str(form, "product_id");
  const { error } = await staff.sb.from("product_images").delete().eq("id", str(form, "id"));
  if (error) fail(`/admin/products/${productId}`, dbError(error.message));
  refreshCatalog();
  done(`/admin/products/${productId}`, "Imagen eliminada.");
}

/** Real promotion: the previous price is kept as compare_at_price and recorded. */
export async function startPromotion(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const productId = str(form, "product_id");
  const back = `/admin/products/${productId}`;
  const promo = int(form, "promo_price");
  const { data: p } = await staff.sb.from("products").select("price, compare_at_price").eq("id", productId).single();
  if (!p || !promo || promo >= p.price) fail(back, "El precio promocional debe ser menor al precio actual.");
  const { error } = await staff.sb.from("products").update({ price: promo, compare_at_price: p.price }).eq("id", productId);
  if (error) fail(back, dbError(error.message));
  await staff.sb.from("promotions").insert({
    name: str(form, "name") || "Promoción",
    product_id: productId,
    previous_price: p.price,
    promo_price: promo,
    ends_at: optStr(form, "ends_at"),
    created_by: staff.userId,
  });
  refreshCatalog();
  done(back, "Promoción activada.");
}

export async function endPromotion(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const productId = str(form, "product_id");
  const back = `/admin/products/${productId}`;
  const { data: p } = await staff.sb.from("products").select("compare_at_price").eq("id", productId).single();
  if (!p?.compare_at_price) fail(back, "El producto no tiene promoción activa.");
  const { error } = await staff.sb.from("products").update({ price: p.compare_at_price, compare_at_price: null }).eq("id", productId);
  if (error) fail(back, dbError(error.message));
  await staff.sb.from("promotions").update({ is_active: false, ends_at: new Date().toISOString() }).eq("product_id", productId).eq("is_active", true);
  refreshCatalog();
  done(back, "Promoción finalizada; precio restaurado.");
}
