import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/services/catalog";
import { supabaseService } from "@/lib/supabase/server";
import { mapWompiStatus, type WompiTransaction } from "@/services/payments/wompi";

/**
 * Applies a verified Wompi transaction to its order. Only call with a
 * transaction that came from a signature-verified webhook or directly from
 * the Wompi API — never with data from the browser.
 */
export async function applyWompiTransaction(tx: WompiTransaction) {
  const sb = supabaseService();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  const { data: order, error } = await sb.from("orders").select("id, number, total, status").eq("number", tx.reference).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return { ok: false as const, reason: "ORDER_NOT_FOUND" };
  if (tx.currency !== "COP") return { ok: false as const, reason: "CURRENCY_MISMATCH" };
  const status = mapWompiStatus(tx.status);
  if (status === "pending") return { ok: true as const, status: order.status };
  const { data, error: e2 } = await sb.rpc("confirm_payment", {
    p_order_id: order.id,
    p_provider: "wompi",
    p_transaction_id: tx.id,
    // Wompi works in cents; our orders are in whole pesos
    p_amount: Math.round(tx.amount_in_cents / 100),
    p_status: status,
    p_raw: tx as unknown as Record<string, unknown>,
  });
  if (e2) throw new Error(e2.message);
  // payment may sell or release reserved stock. Not allowed during a page render
  // (checkout/result); there the 60 s cache window plus the webhook cover it.
  try {
    revalidateTag(CATALOG_TAG);
  } catch {}
  return { ok: true as const, status: (data as { status: string }).status };
}

export async function getOrderPublicSummary(number: string) {
  const sb = supabaseService();
  if (!sb) return null;
  const { data } = await sb
    .from("orders")
    .select("number, status, total, payment_method, email, order_items(product_name, brand_name, size, color, quantity, unit_price, fulfillment_type, lead_time_days)")
    .eq("number", number)
    .maybeSingle();
  return data;
}
