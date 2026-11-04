import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/services/catalog";
import { supabaseService } from "@/lib/supabase/server";
import { mapWompiStatus, type WompiTransaction } from "@/services/payments/wompi";
import type { PaymentMethodId } from "@/types/domain";

/** "T3-261104-1001" or a retry reference "T3-261104-1001-2" → the order number. */
export function orderNumberFromReference(reference: string): string | null {
  const m = /^(T3-\d{6}-\d+)(?:-\d{1,3})?$/.exec(String(reference ?? "").trim().toUpperCase());
  return m ? m[1] : null;
}

export interface VerifiedPayment {
  provider: Exclude<PaymentMethodId, "transfer">;
  reference: string;
  transactionId: string;
  /** COP whole pesos as reported by the provider. */
  amount: number;
  currency: string;
  status: "approved" | "declined" | "voided" | "error" | "pending";
  raw: unknown;
}

/**
 * Applies a payment to its order. Only call with data that came from a
 * signature-verified webhook or straight from the provider's API — never with
 * data from the browser. The database re-checks amount, state and quote.
 */
export async function applyVerifiedPayment(p: VerifiedPayment) {
  const sb = supabaseService();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  const number = orderNumberFromReference(p.reference);
  if (!number) return { ok: false as const, reason: "BAD_REFERENCE" };
  const { data: order, error } = await sb.from("orders").select("id, number, total, status").eq("number", number).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return { ok: false as const, reason: "ORDER_NOT_FOUND" };
  if (p.currency !== "COP") return { ok: false as const, reason: "CURRENCY_MISMATCH" };
  const { data, error: e2 } = await sb.rpc("confirm_payment", {
    p_order_id: order.id,
    p_provider: p.provider,
    p_transaction_id: p.transactionId,
    p_amount: Math.round(p.amount),
    p_status: p.status,
    p_raw: p.raw as Record<string, unknown>,
  });
  if (e2) throw new Error(e2.message);
  // A payment may sell or release reserved stock. Not allowed during a page
  // render (checkout/result); there the cache window plus the webhook cover it.
  try {
    revalidateTag(CATALOG_TAG);
  } catch {}
  return { ok: true as const, number, status: (data as { status: string }).status };
}

export async function applyWompiTransaction(tx: WompiTransaction) {
  return applyVerifiedPayment({
    provider: "wompi",
    reference: tx.reference,
    transactionId: tx.id,
    // Wompi works in cents; our orders are in whole pesos
    amount: Math.round(tx.amount_in_cents / 100),
    currency: tx.currency,
    status: mapWompiStatus(tx.status),
    raw: tx,
  });
}

/** Records a payment notification (accepted or not) in the payment events log. */
export async function logPaymentEvent(row: {
  provider: string;
  eventKey: string;
  payload: unknown;
  status: "received" | "processed" | "ignored" | "rejected" | "error";
  error?: string | null;
  orderNumber?: string | null;
}) {
  const sb = supabaseService();
  if (!sb) return { duplicate: false, error: "no service key" };
  const { error } = await sb.from("webhook_events").insert({
    provider: row.provider,
    event_key: row.eventKey.slice(0, 200),
    payload: row.payload ?? {},
    status: row.status,
    error: row.error ?? null,
    order_number: row.orderNumber ?? null,
    processed_at: row.status === "received" ? null : new Date().toISOString(),
  });
  if (error?.code === "23505") return { duplicate: true };
  if (error) console.error(`[${row.provider}] webhook log failed`, error.message);
  return { duplicate: false };
}

export async function updatePaymentEvent(provider: string, eventKey: string, patch: { status: "processed" | "ignored" | "error"; error?: string | null; orderNumber?: string | null }) {
  const sb = supabaseService();
  if (!sb) return;
  await sb
    .from("webhook_events")
    .update({ status: patch.status, error: patch.error ?? null, order_number: patch.orderNumber ?? undefined, processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_key", eventKey.slice(0, 200));
}

export async function forgetPaymentEvent(provider: string, eventKey: string) {
  const sb = supabaseService();
  if (!sb) return;
  await sb.from("webhook_events").delete().eq("provider", provider).eq("event_key", eventKey.slice(0, 200));
}

export interface CustomerOrder {
  id: string;
  number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_quote_status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  email: string;
  first_name: string;
  city: string;
  department: string;
  address: string;
  created_at: string;
  reservation_expires_at: string | null;
  shipping_zone: string | null;
  access_token: string;
  order_items: { product_name: string; brand_name: string; size: string; color: string; quantity: number; unit_price: number; fulfillment_type: string; lead_time_days: number | null }[];
  shipments: { status: string; carrier: string | null; tracking_number: string | null; shipped_at: string | null; delivered_at: string | null; estimated_delivery: string | null } | null;
  shipment_events: { status: string; note: string | null; occurred_at: string }[];
  order_events: { status: string | null; created_at: string }[];
}

const CUSTOMER_ORDER_SELECT =
  "id, number, status, payment_status, payment_method, shipping_quote_status, subtotal, shipping, discount, total, email, first_name, city, department, address, created_at, reservation_expires_at, shipping_zone, access_token," +
  " order_items(product_name, brand_name, size, color, quantity, unit_price, fulfillment_type, lead_time_days)," +
  " shipments(status, carrier, tracking_number, shipped_at, delivered_at, estimated_delivery)," +
  " shipment_events(status, note, occurred_at)," +
  " order_events(status, created_at)";

/** Customer-facing order lookup. Requires the order's secret token (from the link we gave them). */
export async function getOrderByToken(number: string, token: string): Promise<CustomerOrder | null> {
  const sb = supabaseService();
  if (!sb || !number || !token || token.length < 32) return null;
  const { data } = await sb.from("orders").select(CUSTOMER_ORDER_SELECT).eq("number", number.toUpperCase()).eq("access_token", token).maybeSingle();
  if (!data) return null;
  const o = data as unknown as CustomerOrder & { shipments: CustomerOrder["shipments"] | CustomerOrder["shipments"][] };
  // one-to-one embeds may come back as an object or a 1-item array depending on PostgREST
  return { ...o, shipments: Array.isArray(o.shipments) ? (o.shipments[0] ?? null) : o.shipments, shipment_events: o.shipment_events ?? [], order_events: o.order_events ?? [] };
}

export { CUSTOMER_ORDER_SELECT };
