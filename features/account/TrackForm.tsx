"use client";
import { useActionState } from "react";
import { trackOrder, type TrackResult } from "@/features/account/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel } from "@/features/account/status";

export function TrackForm({ defaultNumber }: { defaultNumber?: string }) {
  const [state, action, pending] = useActionState<TrackResult | null, FormData>(trackOrder, null);
  return (
    <>
      <form action={action} className="mt-10 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="number" className="field-label">Número de pedido</label>
          <input id="number" name="number" defaultValue={defaultNumber} placeholder="T3-261104-1001" className="field uppercase" required />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Correo de la compra</label>
          <input id="email" name="email" type="email" className="field" required />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary sm:col-span-2">{pending ? "Consultando…" : "Consultar"}</button>
      </form>
      {state?.error && <p role="alert" className="mt-6 text-crimson">{state.error}</p>}
      {state?.order && (
        <section className="mt-10 border border-line bg-coal p-6" aria-live="polite">
          <p className="eyebrow">Pedido {state.order.number} · {formatDate(state.order.created_at)}</p>
          <p className="mt-2 font-display text-2xl">{orderStatusLabel[state.order.status] ?? state.order.status}</p>
          {state.order.shipment && (
            <p className="mt-3 text-sm">Transportadora: <strong>{state.order.shipment.carrier}</strong> · Guía: <strong>{state.order.shipment.tracking_number}</strong></p>
          )}
          <ul className="mt-6 space-y-2 text-sm text-bone/80">
            {state.order.items.map((i, n) => (
              <li key={n}>{i.quantity} × {i.brand} {i.name} · T{i.size} · {i.color}{i.fulfillment === "on_order" ? ` · bajo pedido (~${i.lead_time_days ?? "?"} días)` : ""}</li>
            ))}
          </ul>
          <ol className="mt-6 space-y-1 border-l border-line pl-4 text-xs text-smoke">
            {state.order.events?.map((e, n) => <li key={n}>{formatDate(e.at)} · {orderStatusLabel[e.status] ?? e.status}</li>)}
          </ol>
          <p className="mt-4 text-right font-display">Total {formatCOP(state.order.total)}</p>
        </section>
      )}
    </>
  );
}
