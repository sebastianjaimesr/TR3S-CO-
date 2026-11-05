"use client";
import { useActionState } from "react";
import { trackOrder, type TrackResult } from "@/features/account/actions";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel, quoteStatusLabel, shipmentStatusLabel } from "@/features/account/status";
import { OrderProgress } from "@/features/orders/OrderProgress";

export function TrackForm({ defaultNumber }: { defaultNumber?: string }) {
  const [state, action, pending] = useActionState<TrackResult | null, FormData>(trackOrder, null);
  const o = state?.order;
  return (
    <>
      <form action={action} className="mt-10 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="number" className="field-label">Número de pedido</label>
          <input id="number" name="number" defaultValue={defaultNumber} placeholder="T3-261104-1001" className="field uppercase" required />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Correo de la compra</label>
          <input id="email" name="email" type="email" autoComplete="email" className="field" required />
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary sm:col-span-2">{pending ? "Consultando…" : "Consultar"}</button>
        <p className="text-xs text-smoke sm:col-span-2">Por seguridad pedimos el número y el correo con el que compraste. No mostramos datos de entrega aquí.</p>
      </form>
      {state?.error && <p role="alert" className="mt-6 text-crimson">{state.error}</p>}
      {o && (
        <section className="mt-10 border border-line bg-coal p-6" aria-live="polite">
          <p className="eyebrow">Pedido {o.number} · {formatDate(o.created_at)}</p>
          <p className="mt-2 font-display text-2xl">{orderStatusLabel[o.status] ?? o.status}</p>
          <OrderProgress status={o.status} paymentStatus={o.payment_status} shipmentStatus={o.shipment?.status ?? null} />
          <dl className="mt-8 grid gap-px border border-line bg-line text-sm sm:grid-cols-3">
            <div className="bg-ink p-4"><dt className="eyebrow">Pago</dt><dd className="mt-1">{paymentStatusLabel[o.payment_status] ?? o.payment_status}</dd><dd className="text-xs text-smoke">{paymentMethodLabel[o.payment_method] ?? o.payment_method}</dd></div>
            <div className="bg-ink p-4"><dt className="eyebrow">Pedido</dt><dd className="mt-1">{orderStatusLabel[o.status] ?? o.status}</dd></div>
            <div className="bg-ink p-4">
              <dt className="eyebrow">Envío</dt>
              <dd className="mt-1">{o.shipment ? shipmentStatusLabel[o.shipment.status] ?? o.shipment.status : o.shipping_quote_status !== "not_required" ? quoteStatusLabel[o.shipping_quote_status] : "Por preparar"}</dd>
            </div>
          </dl>
          {o.shipment?.carrier && (
            <p className="mt-4 text-sm">
              Transportadora: <strong>{o.shipment.carrier}</strong>
              {o.shipment.tracking_number && <> · Guía: <strong>{o.shipment.tracking_number}</strong></>}
              {o.shipment.estimated_delivery && <> · Entrega estimada {formatDate(o.shipment.estimated_delivery)}</>}
            </p>
          )}
          <ul className="mt-6 space-y-2 text-sm text-bone/80">
            {o.items.map((i, n) => (
              <li key={n}>{i.quantity} × {i.brand} {i.name} · T{i.size} · {i.color}{i.fulfillment === "on_order" ? ` · bajo pedido (~${i.lead_time_days ?? "?"} días)` : ""}</li>
            ))}
          </ul>
          {o.shipment_events?.length ? (
            <>
              <p className="eyebrow mt-6">Historial de envío</p>
              <ol className="mt-2 space-y-1 border-l border-line pl-4 text-xs text-smoke">
                {o.shipment_events.map((e, n) => <li key={n}>{formatDate(e.at)} · {shipmentStatusLabel[e.status] ?? e.status}{e.note ? ` — ${e.note}` : ""}</li>)}
              </ol>
            </>
          ) : null}
          <p className="eyebrow mt-6">Historial del pedido</p>
          <ol className="mt-2 space-y-1 border-l border-line pl-4 text-xs text-smoke">
            {o.events?.map((e, n) => <li key={n}>{formatDate(e.at)} · {orderStatusLabel[e.status] ?? e.status}</li>)}
          </ol>
          <p className="mt-4 text-right font-display">Total {formatCOP(o.total)}</p>
        </section>
      )}
    </>
  );
}
