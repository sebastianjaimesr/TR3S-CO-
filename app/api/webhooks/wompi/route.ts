import { NextResponse } from "next/server";
import { serverEnv, isWompiConfigured } from "@/lib/env";
import { verifyEvent, type WompiEvent } from "@/services/payments/wompi";
import { applyWompiTransaction, forgetPaymentEvent, logPaymentEvent, orderNumberFromReference, updatePaymentEvent } from "@/services/orders";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wompi event webhook. Configure in the Wompi dashboard: https://<domain>/api/webhooks/wompi */
export async function POST(req: Request) {
  if (!isWompiConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!supabaseService()) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  let event: WompiEvent;
  try {
    event = (await req.json()) as WompiEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const headerChecksum = req.headers.get("x-event-checksum");
  const signatureOk =
    !(headerChecksum && event?.signature?.checksum && headerChecksum.toLowerCase() !== String(event.signature.checksum).toLowerCase()) &&
    verifyEvent(event, serverEnv().wompiEventsSecret);
  const tx = event?.data?.transaction;
  if (!signatureOk) {
    console.warn("[wompi] rejected event with invalid checksum");
    await logPaymentEvent({
      provider: "wompi",
      eventKey: `rejected:${Date.now()}:${tx?.id ?? "?"}`,
      payload: { event: event?.event, transaction_id: tx?.id, reference: tx?.reference },
      status: "rejected",
      error: "Firma (checksum) inválida",
      orderNumber: tx?.reference ? orderNumberFromReference(tx.reference) : null,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (event.event !== "transaction.updated" || !tx) return NextResponse.json({ ok: true, ignored: true });

  // Replay protection: each (transaction, status) is processed once.
  const key = `${tx.id}:${tx.status}`;
  const logged = await logPaymentEvent({ provider: "wompi", eventKey: key, payload: event, status: "received", orderNumber: orderNumberFromReference(tx.reference) });
  if (logged.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const res = await applyWompiTransaction(tx);
    await updatePaymentEvent("wompi", key, res.ok ? { status: "processed" } : { status: "ignored", error: res.reason });
    return NextResponse.json(res);
  } catch (e) {
    console.error("[wompi] apply failed", e);
    // allow Wompi's retry to be processed; 500 makes Wompi retry later
    await forgetPaymentEvent("wompi", key);
    await logPaymentEvent({ provider: "wompi", eventKey: `error:${Date.now()}:${key}`, payload: { transaction_id: tx.id }, status: "error", error: String((e as Error).message ?? e).slice(0, 500), orderNumber: orderNumberFromReference(tx.reference) });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
