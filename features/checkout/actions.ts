"use server";
import { revalidateTag } from "next/cache";
import { checkoutSchema, checkoutErrorMessage, departments, orderAccessSchema, type CheckoutInput } from "@/validations/checkout";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CATALOG_TAG } from "@/services/catalog";
import { getProvider } from "@/services/payments/providers";

export type PlaceOrderResult =
  | { ok: true; redirectUrl: string; orderNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const orderPage = (number: string, token: string, extra = "") =>
  `/checkout/result?order=${encodeURIComponent(number)}&t=${encodeURIComponent(token)}${extra}`;

interface StartedPayment {
  number: string;
  reference: string;
  total: number;
  email: string;
  first_name: string;
  last_name: string;
  expires_at: string | null;
}

/** Asks the database for a payment attempt and the provider for its redirect. */
async function beginPayment(number: string, token: string, method: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const provider = getProvider(method);
  if (!provider || !provider.implemented || !provider.configured()) return { ok: false, error: "Ese método de pago no está disponible en este momento." };
  const sb = await supabaseServer();
  if (!sb) return { ok: false, error: "La tienda no tiene base de datos configurada." };
  const { data, error } = await sb.rpc("start_order_payment", { p_number: number, p_token: token, p_method: method });
  if (error) return { ok: false, error: checkoutErrorMessage(error.message) };
  const p = data as StartedPayment;
  if (method === "transfer") return { ok: true, url: orderPage(p.number, token, "&method=transfer") };
  try {
    const url = await provider.createRedirect({
      orderNumber: p.number,
      reference: p.reference,
      amount: p.total,
      email: p.email,
      firstName: p.first_name,
      lastName: p.last_name,
      returnUrl: `${publicEnv.siteUrl}${orderPage(p.number, token, `&provider=${method}`)}`,
      expiresAt: p.expires_at,
    });
    return url ? { ok: true, url } : { ok: false, error: "No pudimos iniciar el pago." };
  } catch (e) {
    console.error(`[checkout] ${method} redirect failed`, e);
    return { ok: false, error: `No pudimos conectar con ${provider.label}. Tu pedido quedó guardado: intenta de nuevo o elige otro método.` };
  }
}

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const ip = await clientIp();
  const rl = rateLimit(`checkout:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: `Demasiados intentos. Intenta de nuevo en ${rl.retryAfter} s.` };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    const items = parsed.error.issues.some((i) => i.path[0] === "items");
    return { ok: false, error: items ? "Tu carrito está vacío o contiene productos que no se pueden comprar." : "Revisa los campos marcados.", fieldErrors };
  }
  const d = parsed.data;

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "La tienda aún no tiene base de datos configurada: no se pueden recibir pedidos reales todavía." };
  }
  const provider = getProvider(d.paymentMethod);
  if (!provider || !provider.implemented || !provider.configured()) {
    return { ok: false, error: "Ese método de pago aún no está habilitado. Elige otro o escríbenos por WhatsApp." };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb!.rpc("create_order", {
    p: {
      idempotency_key: d.idempotencyKey,
      payment_method: d.paymentMethod,
      coupon_code: d.couponCode || null,
      customer: {
        email: d.email,
        first_name: d.firstName,
        last_name: d.lastName,
        phone: d.phone,
        department: d.department,
        city: d.city,
        address: d.address,
        address_notes: d.addressNotes,
      },
      items: d.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    },
  });
  if (error) {
    console.error("[checkout] create_order failed", error.message);
    return { ok: false, error: checkoutErrorMessage(error.message) };
  }
  const order = data as { order_id: string; number: string; total: number; access_token: string; shipping_quote_status: string; duplicate: boolean };
  // Stock was reserved: refresh cached availability so the storefront never offers it twice.
  revalidateTag(CATALOG_TAG);

  // Shipping must be quoted first: nothing is charged until the customer accepts it.
  if (order.shipping_quote_status === "pending" || order.shipping_quote_status === "quoted") {
    return { ok: true, orderNumber: order.number, redirectUrl: orderPage(order.number, order.access_token, "&new=1") };
  }
  const started = await beginPayment(order.number, order.access_token, d.paymentMethod);
  if (!started.ok) {
    // The order exists; send the customer to its page where they can retry.
    return { ok: true, orderNumber: order.number, redirectUrl: orderPage(order.number, order.access_token, `&error=${encodeURIComponent(started.error)}`) };
  }
  return { ok: true, orderNumber: order.number, redirectUrl: started.url };
}

export type OrderActionResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

/** Pay (or retry paying) an existing order from its page. */
export async function payOrder(number: string, token: string, method: string): Promise<OrderActionResult> {
  const rl = rateLimit(`pay:${await clientIp()}`, 15, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: "Demasiados intentos. Espera un momento." };
  const parsed = orderAccessSchema.safeParse({ number, token });
  if (!parsed.success) return { ok: false, error: "Enlace de pedido inválido." };
  const res = await beginPayment(parsed.data.number, parsed.data.token, method);
  return res.ok ? { ok: true, redirectUrl: res.url } : res;
}

export async function acceptShippingQuote(number: string, token: string): Promise<OrderActionResult> {
  const rl = rateLimit(`quote:${await clientIp()}`, 15, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: "Demasiados intentos. Espera un momento." };
  const parsed = orderAccessSchema.safeParse({ number, token });
  if (!parsed.success) return { ok: false, error: "Enlace de pedido inválido." };
  const sb = await supabaseServer();
  if (!sb) return { ok: false, error: "La tienda no tiene base de datos configurada." };
  const { error } = await sb.rpc("accept_shipping_quote", { p_number: parsed.data.number, p_token: parsed.data.token });
  if (error) return { ok: false, error: checkoutErrorMessage(error.message) };
  return { ok: true, redirectUrl: orderPage(parsed.data.number, parsed.data.token) };
}

export interface ShippingEstimate {
  amount: number | null;
  requiresQuote: boolean;
  zone: string | null;
  eta: string | null;
}

/** Display-only estimate for the checkout; the order total is always recomputed in create_order. */
export async function estimateShipping(department: string, city: string, subtotal: number): Promise<ShippingEstimate | null> {
  if (!isSupabaseConfigured() || !(departments as readonly string[]).includes(department)) return null;
  const sb = await supabaseServer();
  const { data, error } = await sb!.rpc("resolve_shipping", {
    p_department: department,
    p_city: city.slice(0, 60),
    p_subtotal: Math.max(0, Math.min(Math.round(subtotal) || 0, 100_000_000)),
  });
  if (error || !data) return null;
  const r = data as { amount: number | null; requires_quote: boolean; zone: string | null; eta: string | null };
  return { amount: r.amount, requiresQuote: r.requires_quote, zone: r.zone, eta: r.eta };
}
