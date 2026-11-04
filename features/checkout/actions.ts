"use server";
import { checkoutSchema, checkoutErrorMessage, type CheckoutInput } from "@/validations/checkout";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured, isWompiConfigured, publicEnv, serverEnv } from "@/lib/env";
import { buildCheckoutUrl } from "@/services/payments/wompi";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/services/catalog";

export type PlaceOrderResult =
  | { ok: true; redirectUrl: string; orderNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  const ip = await clientIp();
  const rl = rateLimit(`checkout:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) return { ok: false, error: `Demasiados intentos. Intenta de nuevo en ${rl.retryAfter} s.` };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    const demo = parsed.error.issues.some((i) => i.path[0] === "items");
    return { ok: false, error: demo ? "Tu carrito contiene productos DEMO o inválidos, que no se pueden comprar." : "Revisa los campos marcados.", fieldErrors };
  }
  const d = parsed.data;

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "La tienda aún no tiene base de datos configurada: no se pueden recibir pedidos reales todavía." };
  }
  if (d.paymentMethod === "wompi" && !isWompiConfigured()) {
    return { ok: false, error: "El pago con Wompi aún no está habilitado. Elige transferencia o escríbenos por WhatsApp." };
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
  const order = data as { order_id: string; number: string; total: number };
  // Stock was reserved: refresh cached availability so the storefront never offers it twice.
  revalidateTag(CATALOG_TAG);
  const resultUrl = `${publicEnv.siteUrl}/checkout/result?order=${encodeURIComponent(order.number)}`;

  if (d.paymentMethod === "transfer") {
    return { ok: true, orderNumber: order.number, redirectUrl: `/checkout/result?order=${encodeURIComponent(order.number)}&method=transfer` };
  }

  const url = buildCheckoutUrl({
    publicKey: publicEnv.wompiPublicKey,
    reference: order.number,
    amountInCents: order.total * 100,
    integritySecret: serverEnv().wompiIntegritySecret,
    redirectUrl: resultUrl,
    customerEmail: d.email,
  });
  return { ok: true, orderNumber: order.number, redirectUrl: url };
}
