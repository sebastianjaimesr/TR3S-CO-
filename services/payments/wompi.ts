import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Wompi (Colombia) integration helpers, following the official docs:
 * - Web Checkout with integrity signature: SHA256(reference + amountInCents + currency + integritySecret)
 * - Event webhooks: checksum = SHA256(concat(values of signature.properties) + timestamp + eventsSecret)
 * - Transaction verification: GET {api}/transactions/{id} with the public key.
 * Card data never touches our servers.
 */

export const WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

export function wompiApiBase(env: "sandbox" | "production") {
  return env === "production" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export function integritySignature(reference: string, amountInCents: number, currency: string, integritySecret: string) {
  if (!Number.isInteger(amountInCents) || amountInCents <= 0) throw new Error("amountInCents must be a positive integer");
  return sha256(`${reference}${amountInCents}${currency}${integritySecret}`);
}

export function buildCheckoutUrl(opts: {
  publicKey: string;
  reference: string;
  amountInCents: number;
  integritySecret: string;
  redirectUrl: string;
  customerEmail?: string;
  currency?: string;
}) {
  const currency = opts.currency ?? "COP";
  const params = new URLSearchParams({
    "public-key": opts.publicKey,
    currency,
    "amount-in-cents": String(opts.amountInCents),
    reference: opts.reference,
    "signature:integrity": integritySignature(opts.reference, opts.amountInCents, currency, opts.integritySecret),
    "redirect-url": opts.redirectUrl,
  });
  if (opts.customerEmail) params.set("customer-data:email", opts.customerEmail);
  return `${WOMPI_CHECKOUT_URL}?${params.toString()}`;
}

export interface WompiEvent {
  event: string;
  data: { transaction?: WompiTransaction } & Record<string, unknown>;
  environment?: string;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

export interface WompiTransaction {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
  amount_in_cents: number;
  reference: string;
  currency: string;
  payment_method_type?: string;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

export function eventChecksum(event: Pick<WompiEvent, "data" | "signature" | "timestamp">, eventsSecret: string) {
  const values = event.signature.properties.map((p) => String(getPath(event.data, p) ?? "")).join("");
  return sha256(`${values}${event.timestamp}${eventsSecret}`);
}

export function verifyEvent(event: WompiEvent, eventsSecret: string): boolean {
  if (!event?.signature?.checksum || !Array.isArray(event.signature.properties) || typeof event.timestamp !== "number") return false;
  const expected = Buffer.from(eventChecksum(event, eventsSecret), "hex");
  const given = Buffer.from(String(event.signature.checksum).toLowerCase(), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function mapWompiStatus(s: WompiTransaction["status"]): "approved" | "declined" | "voided" | "error" | "pending" {
  return ({ APPROVED: "approved", DECLINED: "declined", VOIDED: "voided", ERROR: "error", PENDING: "pending" } as const)[s] ?? "error";
}

export async function fetchTransaction(id: string, env: "sandbox" | "production", publicKey: string): Promise<WompiTransaction | null> {
  const res = await fetch(`${wompiApiBase(env)}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${publicKey}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: WompiTransaction };
  return json.data ?? null;
}
