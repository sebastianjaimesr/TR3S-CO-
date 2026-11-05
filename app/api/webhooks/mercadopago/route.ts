import { NextResponse } from "next/server";
import { isMercadoPagoConfigured, serverEnv } from "@/lib/env";
import { fetchPayment, mapMercadoPagoStatus, verifyWebhookSignature } from "@/services/payments/mercadopago";
import { applyVerifiedPayment, forgetPaymentEvent, logPaymentEvent, orderNumberFromReference, updatePaymentEvent } from "@/services/orders";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mercado Pago webhook (topic "payment").
 * Configure in Tus integraciones → Webhooks: https://<domain>/api/webhooks/mercadopago
 * 1) x-signature is checked with MERCADOPAGO_WEBHOOK_SECRET.
 * 2) The payment is read back from Mercado Pago's API; only that answer counts.
 * 3) (payment id, status) is processed once.
 */
export async function POST(req: Request) {
  if (!isMercadoPagoConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!supabaseService()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const url = new URL(req.url);
  let body: { type?: string; topic?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    // some notifications carry everything in the query string
  }
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic ?? "";
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body.data?.id != null ? String(body.data.id) : null);
  const env = serverEnv();

  const valid = verifyWebhookSignature({
    signatureHeader: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id") ?? dataId,
    secret: env.mercadoPagoWebhookSecret,
  });
  if (!valid) {
    await logPaymentEvent({
      provider: "mercadopago",
      eventKey: `rejected:${Date.now()}:${dataId ?? "?"}`,
      payload: { type, data_id: dataId },
      status: "rejected",
      error: "Firma x-signature inválida o ausente",
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true, ignored: true });

  const payment = await fetchPayment(dataId, env.mercadoPagoAccessToken);
  if (!payment) {
    await logPaymentEvent({ provider: "mercadopago", eventKey: `error:${Date.now()}:${dataId}`, payload: { data_id: dataId }, status: "error", error: "No se pudo consultar el pago en Mercado Pago" });
    // 500 → Mercado Pago retries later
    return NextResponse.json({ error: "payment lookup failed" }, { status: 500 });
  }

  const status = mapMercadoPagoStatus(payment.status);
  const key = `${payment.id}:${payment.status}`;
  const number = payment.external_reference ? orderNumberFromReference(payment.external_reference) : null;
  const logged = await logPaymentEvent({
    provider: "mercadopago",
    eventKey: key,
    payload: { notification: body, payment: { id: payment.id, status: payment.status, status_detail: payment.status_detail, amount: payment.transaction_amount, currency: payment.currency_id, external_reference: payment.external_reference, live_mode: payment.live_mode } },
    status: "received",
    orderNumber: number,
  });
  if (logged.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const res = await applyVerifiedPayment({
      provider: "mercadopago",
      reference: payment.external_reference ?? "",
      transactionId: String(payment.id),
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      status,
      raw: payment,
    });
    await updatePaymentEvent("mercadopago", key, res.ok ? { status: "processed" } : { status: "ignored", error: res.reason });
    return NextResponse.json(res);
  } catch (e) {
    console.error("[mercadopago] apply failed", e);
    await forgetPaymentEvent("mercadopago", key);
    await logPaymentEvent({ provider: "mercadopago", eventKey: `error:${Date.now()}:${key}`, payload: { payment_id: payment.id }, status: "error", error: String((e as Error).message ?? e).slice(0, 500), orderNumber: number });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
