import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago Colombia — Checkout Pro (redirect) helpers.
 *
 * - Checkout: POST https://api.mercadopago.com/checkout/preferences with the
 *   server-side access token. The buyer is redirected to `init_point`.
 * - Webhooks: topic "payment". Authenticity is checked with the `x-signature`
 *   header (HMAC-SHA256 of the manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *   using the secret from "Tus integraciones → Webhooks").
 * - The payment is then read back from GET /v1/payments/{id}: only that answer
 *   (status, amount, currency, external_reference) is trusted.
 * Card data never touches our servers.
 */

export const MP_API = "https://api.mercadopago.com";

export interface MercadoPagoPreferenceInput {
  accessToken: string;
  reference: string; // our order number (external_reference)
  amount: number; // COP, whole pesos, already computed by the server
  title: string;
  payer: { email: string; firstName: string; lastName: string };
  backUrl: string; // where the buyer returns (success/pending/failure)
  notificationUrl: string; // our webhook
  expiresAt?: string | null; // ISO, matches the stock reservation
}

export function buildPreferenceBody(input: MercadoPagoPreferenceInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("amount must be a positive integer (COP)");
  return {
    items: [{ id: input.reference, title: input.title.slice(0, 250), quantity: 1, currency_id: "COP", unit_price: input.amount }],
    payer: { email: input.payer.email, name: input.payer.firstName, surname: input.payer.lastName },
    external_reference: input.reference,
    back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
    auto_return: "approved",
    notification_url: input.notificationUrl,
    statement_descriptor: "TR3S AND CO",
    binary_mode: false,
    ...(input.expiresAt ? { expires: true, expiration_date_to: input.expiresAt } : {}),
  };
}

export async function createPreference(input: MercadoPagoPreferenceInput, idempotencyKey: string): Promise<{ id: string; initPoint: string }> {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(buildPreferenceBody(input)),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mercado Pago preference failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id: string; init_point: string };
  return { id: json.id, initPoint: json.init_point };
}

/** Parses `ts=...,v1=...` */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

export function signatureManifest(dataId: string | null, requestId: string | null, ts: string) {
  // Alphanumeric ids must be lower-cased; missing parts are omitted.
  let m = "";
  if (dataId) m += `id:${/[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) m += `request-id:${requestId};`;
  m += `ts:${ts};`;
  return m;
}

export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  /** reject notifications older than this (seconds); 0 disables */
  maxAgeSeconds?: number;
  now?: number;
}): boolean {
  const sig = parseSignatureHeader(opts.signatureHeader);
  if (!sig || !opts.secret) return false;
  if (opts.maxAgeSeconds) {
    const tsNum = Number(sig.ts);
    const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
    if (!Number.isFinite(tsNum) || Math.abs((opts.now ?? Date.now()) - tsMs) > opts.maxAgeSeconds * 1000) return false;
  }
  const expected = createHmac("sha256", opts.secret).update(signatureManifest(opts.dataId, opts.requestId, sig.ts)).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig.v1.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface MercadoPagoPayment {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail?: string;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
  live_mode?: boolean;
  date_approved?: string | null;
}

export async function fetchPayment(id: string, accessToken: string): Promise<MercadoPagoPayment | null> {
  if (!/^\d{1,20}$/.test(id)) return null;
  const res = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as MercadoPagoPayment;
}

export function mapMercadoPagoStatus(s: MercadoPagoPayment["status"]): "approved" | "declined" | "voided" | "error" | "pending" {
  switch (s) {
    case "approved":
      return "approved";
    case "rejected":
      return "declined";
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "voided";
    case "pending":
    case "authorized":
    case "in_process":
    case "in_mediation":
      return "pending";
    default:
      return "error";
  }
}
