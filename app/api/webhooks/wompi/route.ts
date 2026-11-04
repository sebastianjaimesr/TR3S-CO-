import { NextResponse } from "next/server";
import { serverEnv, isWompiConfigured } from "@/lib/env";
import { verifyEvent, type WompiEvent } from "@/services/payments/wompi";
import { applyWompiTransaction } from "@/services/orders";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wompi event webhook. Configure in the Wompi dashboard: https://<domain>/api/webhooks/wompi */
export async function POST(req: Request) {
  if (!isWompiConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let event: WompiEvent;
  try {
    event = (await req.json()) as WompiEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!verifyEvent(event, serverEnv().wompiEventsSecret)) {
    console.warn("[wompi] rejected event with invalid checksum");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (event.event !== "transaction.updated" || !event.data.transaction) return NextResponse.json({ ok: true, ignored: true });
  const tx = event.data.transaction;

  // Replay protection: each (transaction, status) is processed once.
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "service key missing" }, { status: 503 });
  const { error: dupErr } = await sb.from("webhook_events").insert({ provider: "wompi", event_key: `${tx.id}:${tx.status}`, payload: event });
  if (dupErr && dupErr.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (dupErr) console.error("[wompi] webhook log failed", dupErr.message);

  try {
    const res = await applyWompiTransaction(tx);
    return NextResponse.json(res);
  } catch (e) {
    console.error("[wompi] apply failed", e);
    // allow Wompi's retry to be processed
    await sb.from("webhook_events").delete().eq("provider", "wompi").eq("event_key", `${tx.id}:${tx.status}`);
    // 500 makes Wompi retry later
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
