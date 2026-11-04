import { formatCOP } from "@/lib/format";

/** Normalizes a Colombian/international number to wa.me digits; null if invalid. */
export function normalizeWhatsappNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`; // CO mobile without country code
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function whatsappLink(number: string | null | undefined, message: string): string | null {
  const n = normalizeWhatsappNumber(number);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function productInquiryMessage(p: { name: string; brand: string; sku?: string; size?: string; color?: string }) {
  const parts = [`Hola TR3S & CO. Estoy interesado en ${p.brand} ${p.name}`];
  if (p.sku) parts.push(`referencia ${p.sku}`);
  if (p.size) parts.push(`talla ${p.size}`);
  if (p.color) parts.push(`color ${p.color}`);
  return `${parts.join(", ")}. ¿Me pueden confirmar disponibilidad?`;
}

export function cartSummaryMessage(
  items: { name: string; brand: string; sku: string; size: string; color: string; quantity: number; price: number }[],
  subtotal: number,
) {
  const lines = items.map(
    (i) => `• ${i.quantity} x ${i.brand} ${i.name} — ref ${i.sku}, talla ${i.size}, ${i.color} (${formatCOP(i.price * i.quantity)})`,
  );
  return [
    "Hola TR3S & CO. Quiero ayuda para completar esta compra:",
    ...lines,
    `Subtotal: ${formatCOP(subtotal)}`,
    "¿Me confirman disponibilidad y envío?",
  ].join("\n");
}

export function orderFollowUpMessage(orderNumber: string) {
  return `Hola TR3S & CO. Quiero hacer seguimiento a mi pedido ${orderNumber}.`;
}
