"use server";
import { requireStaff } from "@/lib/auth";
import { bool, dbError, done, fail, int, optStr, refreshCatalog, str } from "@/features/admin/actions/common";
import { homeMediaSlots } from "@/lib/home-media";

/* ---------------------------- Shipping zones ---------------------------- */
export async function saveShippingRate(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "id");
  const back = "/admin/shipping?tab=zonas";
  const requiresQuote = bool(form, "requires_quote");
  const row = {
    name: str(form, "name"),
    department: optStr(form, "department"),
    city: optStr(form, "city"),
    rate: requiresQuote ? 0 : int(form, "rate") ?? 0,
    free_from: requiresQuote ? null : int(form, "free_from"),
    requires_quote: requiresQuote,
    eta_text: optStr(form, "eta_text"),
    is_active: id ? bool(form, "is_active") : true,
    position: int(form, "position") ?? 0,
  };
  if (!row.name) fail(back, "Ponle un nombre a la zona (ej. Bucaramanga y área metropolitana).");
  if (row.city && !row.department) fail(back, "Una zona por ciudad necesita también el departamento.");
  if (row.rate < 0 || (row.free_from != null && row.free_from <= 0)) fail(back, "Valores inválidos.");
  const { error } = id ? await staff.sb.from("shipping_rates").update(row).eq("id", id) : await staff.sb.from("shipping_rates").insert(row);
  if (error) fail(back, error.message.includes("duplicate") ? "Ya existe una zona para ese departamento/ciudad." : dbError(error.message));
  done(back, "Zona de envío guardada.");
}

export async function deleteShippingRate(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const { error } = await staff.sb.from("shipping_rates").delete().eq("id", str(form, "id"));
  if (error) fail("/admin/shipping?tab=zonas", dbError(error.message));
  done("/admin/shipping?tab=zonas", "Zona eliminada.");
}

/* ------------------------------- Shipments ------------------------------- */
export async function updateShipment(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const orderId = str(form, "order_id");
  const back = str(form, "back") === "board" ? "/admin/shipping" : `/admin/orders/${orderId}`;
  const occurred = optStr(form, "occurred_at");
  const { error } = await staff.sb.rpc("update_shipment", {
    p_order_id: orderId,
    p_status: str(form, "status"),
    p_carrier: optStr(form, "carrier"),
    p_tracking: optStr(form, "tracking"),
    p_note: optStr(form, "note"),
    p_occurred_at: occurred ? new Date(`${occurred}:00-05:00`).toISOString() : null,
    p_estimated: optStr(form, "estimated_delivery"),
  });
  if (error) {
    const m = error.message;
    fail(
      back,
      m.includes("CARRIER_AND_TRACKING_REQUIRED")
        ? "Para despachar registra transportadora y número de guía."
        : m.includes("ORDER_NOT_PAID")
          ? "El pedido aún no tiene pago confirmado: no se puede despachar."
          : m.includes("ORDER_NOT_READY")
            ? "El pedido todavía no está listo para despacho (revisa proveedor o incidencias)."
            : dbError(m),
    );
  }
  done(back, "Envío actualizado.");
}

export async function setShippingQuote(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const orderId = str(form, "order_id");
  const amount = int(form, "amount");
  if (amount == null || amount < 0) fail(`/admin/orders/${orderId}`, "Indica el valor del envío en COP (0 = gratis).");
  const { error } = await staff.sb.rpc("set_shipping_quote", { p_order_id: orderId, p_amount: amount, p_note: optStr(form, "note") });
  if (error) fail(`/admin/orders/${orderId}`, error.message.includes("QUOTE_NOT_ALLOWED") ? "Este pedido ya no admite cotización." : dbError(error.message));
  done(`/admin/orders/${orderId}`, "Cotización guardada. Envíale al cliente el enlace de su pedido para que la acepte y pague.");
}

/* ------------------------------- Home media ------------------------------ */

/**
 * Publishes a home image slot after a direct browser upload to the `campaigns`
 * bucket (server actions cap request bodies at 1 MB, so files never pass
 * through here). With `path` null only the description is updated.
 */
export async function registerHomeMedia(input: { slot: string; path: string | null; alt: string }): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff(["admin"]);
  const slot = String(input.slot ?? "");
  const alt = String(input.alt ?? "").trim().slice(0, 160);
  if (!homeMediaSlots.some((s) => s.slot === slot)) return { ok: false, error: "Espacio de imagen desconocido." };
  if (!alt) return { ok: false, error: "Describe la imagen (texto alternativo); en el hero también es el nombre que se muestra." };
  let url: string | null = null;
  if (input.path) {
    if (!input.path.startsWith(`home/${slot}-`) || input.path.includes("..")) return { ok: false, error: "Ruta de imagen no permitida." };
    url = staff.sb.storage.from("campaigns").getPublicUrl(input.path).data.publicUrl;
  }
  const { data: existing } = await staff.sb.from("home_media").select("image_url").eq("slot", slot).maybeSingle();
  const image_url = url ?? existing?.image_url ?? null;
  if (!image_url) return { ok: false, error: "Sube una imagen." };
  const { error } = await staff.sb.from("home_media").upsert({ slot, image_url, alt, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: dbError(error.message) };
  refreshCatalog();
  return { ok: true };
}

export async function clearHomeMedia(form: FormData) {
  const staff = await requireStaff(["admin"]);
  const { error } = await staff.sb.from("home_media").delete().eq("slot", str(form, "slot"));
  if (error) fail("/admin/home", dbError(error.message));
  refreshCatalog();
  done("/admin/home", "Imagen retirada: el espacio vuelve al diseño gráfico de marca.");
}
