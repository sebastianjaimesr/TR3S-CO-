import type { Metadata } from "next";
import Link from "next/link";
import { fetchTransaction } from "@/services/payments/wompi";
import { applyWompiTransaction, getOrderPublicSummary } from "@/services/orders";
import { getStoreSettings } from "@/services/catalog";
import { isWompiConfigured, publicEnv, serverEnv } from "@/lib/env";
import { formatCOP } from "@/lib/format";
import { orderFollowUpMessage, whatsappLink } from "@/services/whatsapp";

export const metadata: Metadata = { title: "Estado del pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

const statusCopy: Record<string, string> = {
  pending_payment: "Esperando confirmación del pago.",
  awaiting_transfer: "Esperando tu transferencia.",
  awaiting_supplier: "Pago recibido. Estamos confirmando la disponibilidad con el proveedor.",
  preparing: "Pago recibido. Estamos preparando tu pedido.",
  shipped: "Tu pedido va en camino.",
  delivered: "Pedido entregado.",
  cancelled: "Pedido cancelado.",
  incident: "Estamos revisando tu pedido. Te contactaremos pronto.",
};

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ order?: string; id?: string; method?: string }> }) {
  const { order: number, id, method } = await searchParams;
  // Server-side verification with Wompi: the redirect itself never marks an order as paid.
  if (id && isWompiConfigured()) {
    const tx = await fetchTransaction(id, serverEnv().wompiEnv, publicEnv.wompiPublicKey);
    if (tx && tx.reference === number) await applyWompiTransaction(tx).catch((e) => console.error("[result] apply", e));
  }
  const [order, settings] = await Promise.all([number ? getOrderPublicSummary(number) : null, getStoreSettings()]);
  const wa = number ? whatsappLink(settings.whatsappNumber, orderFollowUpMessage(number)) : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl font-bold">No encontramos el pedido</h1>
        <Link href="/orders/track" className="btn btn-primary mt-8">Rastrear pedido</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="eyebrow">Pedido {order.number}</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Gracias por comprar en TR3S &amp; CO.</h1>
      <p className="mt-4 text-lg text-bone/80">{statusCopy[order.status] ?? order.status}</p>
      {(method === "transfer" || order.status === "awaiting_transfer") && (
        <div className="mt-8 border border-line bg-coal p-6">
          <h2 className="font-display font-semibold">Instrucciones de transferencia</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-bone/80">
            {settings.bankTransferInstructions ?? "Te enviaremos los datos de la cuenta por WhatsApp o correo para completar el pago."}
          </p>
          <p className="mt-3 text-sm">Valor a transferir: <strong>{formatCOP(order.total)}</strong> · Referencia: <strong>{order.number}</strong></p>
          <p className="mt-2 text-xs text-smoke">Reservamos tus productos durante 48 horas.</p>
        </div>
      )}
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {order.order_items?.map((i, idx) => (
          <li key={idx} className="flex justify-between py-3 text-sm">
            <span>{i.quantity} × {i.brand_name} {i.product_name} · T{i.size} · {i.color}{i.fulfillment_type === "on_order" ? ` · bajo pedido (~${i.lead_time_days ?? "?"} días)` : ""}</span>
            <span>{formatCOP(i.unit_price * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right font-display text-xl">Total {formatCOP(order.total)}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`/orders/track?number=${encodeURIComponent(order.number)}`} className="btn btn-primary">Seguir mi pedido</Link>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Escribir por WhatsApp</a>}
      </div>
    </div>
  );
}
