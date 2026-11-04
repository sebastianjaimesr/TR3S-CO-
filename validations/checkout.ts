import { z } from "zod";

export const departments = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare",
  "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
  "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
  "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
] as const;

const name = z.string().trim().min(2, "Mínimo 2 caracteres").max(60);

export const checkoutSchema = z.object({
  firstName: name,
  lastName: name,
  email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+?57)?3\d{9}$/, "Celular colombiano de 10 dígitos")),
  department: z.enum(departments, { message: "Selecciona un departamento" }),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5, "Dirección incompleta").max(160),
  addressNotes: z.string().trim().max(200).optional().default(""),
  paymentMethod: z.enum(["wompi", "mercadopago", "payu", "transfer"], { message: "Elige un método de pago" }),
  couponCode: z.string().trim().toUpperCase().max(30).optional().default(""),
  acceptPolicies: z.literal(true, { message: "Debes aceptar las políticas" }),
  idempotencyKey: z.string().min(16).max(80),
  items: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10) }))
    .min(1, "El carrito está vacío")
    .max(20),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export const orderAccessSchema = z.object({
  number: z.string().trim().toUpperCase().regex(/^T3-\d{6}-\d+$/),
  token: z.string().regex(/^[a-f0-9]{32,128}$/),
});

export const trackOrderSchema = z.object({
  number: z.string().trim().toUpperCase().regex(/^T3-\d{6}-\d+$/, "Formato: T3-AAMMDD-0000"),
  email: z.string().trim().toLowerCase().email(),
});

/** Maps database exception codes to customer-facing Spanish messages. */
export function checkoutErrorMessage(raw: string): string {
  if (raw.includes("DEMO_PRODUCT_NOT_PURCHASABLE")) return "Tu carrito contiene productos DEMO, que no están a la venta.";
  if (raw.includes("OUT_OF_STOCK")) return "Una de las tallas se agotó mientras comprabas. Revisa tu carrito.";
  if (raw.includes("VARIANT_UNAVAILABLE")) return "Uno de los productos ya no está disponible.";
  if (raw.includes("INVALID_COUPON")) return "El cupón no es válido o no aplica a este pedido.";
  if (raw.includes("PAYMENT_METHOD_DISABLED")) return "Ese método de pago no está habilitado.";
  if (raw.includes("EMPTY_CART")) return "Tu carrito está vacío.";
  if (raw.includes("SHIPPING_QUOTE_PENDING")) return "Primero debemos cotizar tu envío y tú aceptarlo. Te avisaremos.";
  if (raw.includes("ORDER_ALREADY_PAID")) return "Este pedido ya está pagado.";
  if (raw.includes("RESERVATION_EXPIRED")) return "La reserva de este pedido venció. Haz el pedido de nuevo.";
  if (raw.includes("ORDER_NOT_PAYABLE")) return "Este pedido ya no admite pagos.";
  if (raw.includes("QUOTE_NOT_READY")) return "La cotización del envío aún no está lista.";
  if (raw.includes("ORDER_NOT_FOUND")) return "No encontramos el pedido.";
  return "No pudimos crear tu pedido. Intenta de nuevo o escríbenos por WhatsApp.";
}
