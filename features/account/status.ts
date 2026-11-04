export const orderStatusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  awaiting_transfer: "Esperando transferencia",
  paid: "Pagado",
  awaiting_supplier: "Confirmando con proveedor",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  incident: "En revisión",
};

/** Order-level payment status (separate from the order lifecycle). */
export const paymentStatusLabel: Record<string, string> = {
  pending: "Pendiente de pago",
  approved: "Pago confirmado",
  declined: "Pago rechazado",
  voided: "Pago anulado o reembolsado",
  error: "Error en el pago",
};

export const shipmentStatusLabel: Record<string, string> = {
  pending_quote: "Pendiente de cotización",
  preparing: "En preparación",
  dispatched: "Despachado",
  in_transit: "En tránsito",
  delivered: "Entregado",
  delivery_issue: "Novedad de entrega",
};

export const quoteStatusLabel: Record<string, string> = {
  not_required: "Tarifa de zona",
  pending: "Pendiente de cotización",
  quoted: "Cotizado · esperando aceptación",
  accepted: "Cotización aceptada",
};

export const paymentMethodLabel: Record<string, string> = {
  wompi: "Wompi",
  mercadopago: "Mercado Pago",
  payu: "PayU",
  transfer: "Transferencia",
};

export type Tone = "ok" | "warn" | "bad" | "muted";

export function paymentTone(s: string): Tone {
  return s === "approved" ? "ok" : s === "pending" ? "warn" : "bad";
}
export function orderTone(s: string): Tone {
  return s === "incident" || s === "cancelled" ? "bad" : s === "delivered" || s === "shipped" ? "ok" : "warn";
}
export function shipmentTone(s: string | null | undefined): Tone {
  return !s ? "muted" : s === "delivered" ? "ok" : s === "delivery_issue" ? "bad" : "warn";
}

/** The 5 customer-facing milestones and how far an order has gone. */
export const progressSteps = ["Pedido recibido", "Pago confirmado", "En preparación", "Enviado", "Entregado"] as const;

export function progressIndex(o: { status: string; payment_status?: string | null; shipment_status?: string | null }): number {
  if (o.status === "delivered" || o.shipment_status === "delivered") return 4;
  if (o.status === "shipped" || o.shipment_status === "dispatched" || o.shipment_status === "in_transit" || o.shipment_status === "delivery_issue") return 3;
  if (o.status === "preparing" || o.status === "awaiting_supplier") return 2;
  if (o.payment_status === "approved") return 1;
  return 0;
}
