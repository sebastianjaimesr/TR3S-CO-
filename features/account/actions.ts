"use server";
import { trackOrderSchema } from "@/validations/checkout";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export interface TrackResult {
  ok: boolean;
  error?: string;
  order?: {
    number: string;
    status: string;
    created_at: string;
    total: number;
    subtotal: number;
    shipping: number;
    discount: number;
    payment_method: string;
    payment_status: string;
    shipping_quote_status: string;
    items: { name: string; brand: string; size: string; color: string; quantity: number; fulfillment: string; lead_time_days: number | null }[];
    shipment: { status: string; carrier: string | null; tracking_number: string | null; shipped_at: string | null; delivered_at: string | null; estimated_delivery: string | null } | null;
    shipment_events: { status: string; note: string | null; at: string }[] | null;
    events: { status: string; at: string }[];
  };
}

export async function trackOrder(_: TrackResult | null, form: FormData): Promise<TrackResult> {
  const rl = rateLimit(`track:${await clientIp()}`, 20, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: "Demasiadas consultas. Intenta más tarde." };
  const parsed = trackOrderSchema.safeParse({ number: form.get("number"), email: form.get("email") });
  if (!parsed.success) return { ok: false, error: "Revisa el número de pedido (T3-AAMMDD-0000) y el correo." };
  const sb = await supabaseServer();
  if (!sb) return { ok: false, error: "El rastreo estará disponible cuando la tienda conecte su base de datos." };
  const { data, error } = await sb.rpc("track_order", { p_number: parsed.data.number, p_email: parsed.data.email });
  if (error) return { ok: false, error: "No pudimos consultar el pedido." };
  if (!data) return { ok: false, error: "No encontramos un pedido con ese número y correo." };
  return { ok: true, order: data as TrackResult["order"] };
}
