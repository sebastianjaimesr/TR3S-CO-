import type { Metadata } from "next";
import Link from "next/link";
import { fetchTransaction } from "@/services/payments/wompi";
import { fetchPayment, mapMercadoPagoStatus } from "@/services/payments/mercadopago";
import { applyVerifiedPayment, applyWompiTransaction, getOrderByToken, orderNumberFromReference } from "@/services/orders";
import { getStoreSettings } from "@/services/catalog";
import { isMercadoPagoConfigured, isWompiConfigured, publicEnv, serverEnv } from "@/lib/env";
import { formatCOP, formatDate } from "@/lib/format";
import { orderFollowUpMessage, whatsappLink } from "@/services/whatsapp";
import { availableProviders } from "@/services/payments/providers";
import { OrderProgress } from "@/features/orders/OrderProgress";
import { AcceptQuote, PayPanel } from "@/features/orders/PayPanel";
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel, shipmentStatusLabel } from "@/features/account/status";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type SP = { order?: string; t?: string; id?: string; payment_id?: string; collection_id?: string; method?: string; error?: string; new?: string };

/**
 * Customer order page, reachable only with the secret link (order number + token).
 * Returning from a gateway never marks anything as paid by itself: the
 * transaction id in the URL is looked up server-side with the provider.
 */
export default async function OrderPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const number = sp.order?.toUpperCase() ?? "";
  const token = sp.t ?? "";

  let order = await getOrderByToken(number, token);
  if (order && order.payment_status !== "approved") {
    let verified = false;
    if (sp.id && isWompiConfigured()) {
      const tx = await fetchTransaction(sp.id, serverEnv().wompiEnv, publicEnv.wompiPublicKey).catch(() => null);
      if (tx && orderNumberFromReference(tx.reference) === order.number) {
        await applyWompiTransaction(tx).catch((e) => console.error("[order] wompi apply", e));
        verified = true;
      }
    }
    const mpId = sp.payment_id ?? sp.collection_id;
    if (mpId && isMercadoPagoConfigured()) {
      const p = await fetchPayment(mpId, serverEnv().mercadoPagoAccessToken).catch(() => null);
      if (p && p.external_reference && orderNumberFromReference(p.external_reference) === order.number) {
        await applyVerifiedPayment({
          provider: "mercadopago",
          reference: p.external_reference,
          transactionId: String(p.id),
          amount: p.transaction_amount,
          currency: p.currency_id,
          status: mapMercadoPagoStatus(p.status),
          raw: p,
        }).catch((e) => console.error("[order] mp apply", e));
        verified = true;
      }
    }
    if (verified) order = await getOrderByToken(number, token);
  }

  const settings = await getStoreSettings();
  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="eyebrow">Pedido</p>
        <h1 className="mt-3 font-display text-4xl font-bold">No encontramos el pedido</h1>
        <p className="mt-4 text-smoke">El enlace no es válido o está incompleto. Puedes consultarlo con tu número de pedido y correo.</p>
        <Link href="/orders/track" className="btn btn-primary mt-8">Rastrear pedido</Link>
      </div>
    );
  }

  const wa = whatsappLink(settings.whatsappNumber, orderFollowUpMessage(order.number));
  const quotePending = order.shipping_quote_status === "pending";
  const quoteReady = order.shipping_quote_status === "quoted";
  const payable =
    ["pending_payment", "awaiting_transfer"].includes(order.status) &&
    order.payment_status !== "approved" &&
    !quotePending &&
    !quoteReady &&
    (!order.reservation_expires_at || new Date(order.reservation_expires_at).getTime() > Date.now());
  const providers = availableProviders(settings.paymentMethods);
  const paid = order.payment_status === "approved";
  const shipment = order.shipments;
  const headline = paid
    ? "Gracias por comprar en TR3S & CO."
    : quotePending || quoteReady
      ? "Recibimos tu pedido"
      : order.status === "cancelled"
        ? "Pedido cancelado"
        : "Tu pedido está reservado";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <p className="eyebrow">Pedido {order.number} · {formatDate(order.created_at)}</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">{headline}</h1>
      <p className="mt-3 text-sm text-smoke">Guarda este enlace: es la forma segura de volver a tu pedido. También puedes rastrearlo con el número y tu correo.</p>

      <OrderProgress status={order.status} paymentStatus={order.payment_status} shipmentStatus={shipment?.status ?? null} />

      {sp.error && <p role="alert" className="mt-8 border border-crimson/50 bg-wine/10 p-4 text-sm text-crimson">{sp.error}</p>}

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-7">
          <dl className="grid gap-px border border-line bg-line sm:grid-cols-3">
            <StatusCell label="Pago" value={paymentStatusLabel[order.payment_status] ?? order.payment_status} hint={paymentMethodLabel[order.payment_method]} />
            <StatusCell label="Pedido" value={orderStatusLabel[order.status] ?? order.status} />
            <StatusCell
              label="Envío"
              value={quotePending ? "Pendiente de cotización" : quoteReady ? "Cotizado" : shipment ? shipmentStatusLabel[shipment.status] ?? shipment.status : paid ? "Por preparar" : "—"}
              hint={shipment?.carrier ? `${shipment.carrier}${shipment.tracking_number ? ` · guía ${shipment.tracking_number}` : ""}` : undefined}
            />
          </dl>

          {quotePending && (
            <Box title="Estamos cotizando tu envío">
              <p className="text-sm text-bone/80">
                Para tu ciudad el envío se cotiza a mano. Te escribiremos con el valor; podrás aceptarlo aquí mismo y solo entonces pagar. No se ha hecho ningún cobro.
              </p>
              {order.reservation_expires_at && <p className="mt-2 text-xs text-smoke">Tus productos quedan reservados hasta el {new Date(order.reservation_expires_at).toLocaleString("es-CO")}.</p>}
            </Box>
          )}
          {quoteReady && (
            <Box title="Tu envío ya está cotizado">
              <AcceptQuote number={order.number} token={token} shipping={order.shipping} total={order.total} />
            </Box>
          )}

          {order.status === "awaiting_transfer" && !paid && (
            <Box title="Instrucciones de transferencia">
              <p className="whitespace-pre-line text-sm text-bone/80">
                {settings.bankTransferInstructions ?? "Te enviaremos los datos de la cuenta por WhatsApp o correo para completar el pago."}
              </p>
              <p className="mt-3 text-sm">Valor a transferir: <strong>{formatCOP(order.total)}</strong> · Referencia: <strong>{order.number}</strong></p>
              <p className="mt-2 text-xs text-smoke">Confirmamos el pago manualmente al verlo en el banco. Reservamos tus productos durante 48 horas.</p>
            </Box>
          )}

          {payable && (order.status === "pending_payment" || providers.some((p) => p.id !== "transfer")) && (
            <Box title={order.status === "awaiting_transfer" ? "¿Prefieres pagar en línea?" : order.payment_status === "declined" || order.payment_status === "error" ? "El pago no se completó" : "Completa tu pago"}>
              {order.payment_status === "pending" && (sp.id || sp.payment_id) ? (
                <p className="mb-4 text-sm text-amber-300">Estamos esperando la confirmación del proveedor. Si ya pagaste, no repitas el pago: esta página se actualiza al recargarla.</p>
              ) : null}
              <PayPanel number={order.number} token={token} total={order.total} providers={order.status === "awaiting_transfer" ? providers.filter((p) => p.id !== "transfer") : providers} current={order.payment_method} retry={order.payment_status !== "pending"} />
            </Box>
          )}

          {shipment && (shipment.carrier || order.shipment_events.length > 0) && (
            <Box title="Seguimiento del envío">
              {shipment.carrier && (
                <p className="text-sm">
                  Transportadora <strong>{shipment.carrier}</strong>
                  {shipment.tracking_number && <> · Guía <strong>{shipment.tracking_number}</strong></>}
                  {shipment.estimated_delivery && <> · Entrega estimada {formatDate(shipment.estimated_delivery)}</>}
                </p>
              )}
              <ol className="mt-3 space-y-1 border-l border-line pl-4 text-xs text-smoke">
                {[...order.shipment_events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((e, i) => (
                  <li key={i}>{new Date(e.occurred_at).toLocaleString("es-CO")} · {shipmentStatusLabel[e.status] ?? e.status}{e.note ? ` — ${e.note}` : ""}</li>
                ))}
              </ol>
            </Box>
          )}
        </section>

        <aside className="lg:col-span-5">
          <div className="border border-line bg-coal p-6">
            <h2 className="font-display text-lg font-semibold">Resumen</h2>
            <ul className="mt-4 divide-y divide-line">
              {order.order_items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-4 py-3 text-sm">
                  <span>
                    {i.quantity} × {i.brand_name} {i.product_name}
                    <span className="block text-xs text-smoke">Talla {i.size} · {i.color}{i.fulfillment_type === "on_order" ? ` · bajo pedido (~${i.lead_time_days ?? "?"} días)` : ""}</span>
                  </span>
                  <span>{formatCOP(i.unit_price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <div className="flex justify-between text-bone/70"><dt>Subtotal</dt><dd>{formatCOP(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between text-crimson"><dt>Descuento</dt><dd>−{formatCOP(order.discount)}</dd></div>}
              <div className="flex justify-between text-bone/70"><dt>Envío{order.shipping_zone ? ` · ${order.shipping_zone}` : ""}</dt><dd>{quotePending ? "Por cotizar" : order.shipping === 0 ? "Gratis" : formatCOP(order.shipping)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 font-display text-xl"><dt>Total</dt><dd>{formatCOP(order.total)}{quotePending ? " + envío" : ""}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-smoke">Entrega: {order.address}, {order.city}, {order.department}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/orders/track?number=${encodeURIComponent(order.number)}`} className="btn btn-ghost">Rastrear con mi correo</Link>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Escribir por WhatsApp</a>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ink p-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-base text-paper">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-smoke">{hint}</dd>}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-coal p-6">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}
