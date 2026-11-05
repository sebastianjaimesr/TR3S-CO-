import { createHash } from "node:crypto";

/**
 * PayU Latam (Colombia) — PREPARED, NOT ACTIVE.
 *
 * The provider is registered so the checkout, the admin and the database
 * already know about it, but `implemented` is false: it never appears to
 * customers and the admin cannot switch it on until the WebCheckout redirect
 * and the confirmation endpoint are finished and tested with sandbox keys.
 *
 * Reference (developers.payulatam.com, WebCheckout):
 *   request signature  = MD5("ApiKey~merchantId~referenceCode~amount~currency")
 *   confirmation sign  = MD5("ApiKey~merchant_id~reference_sale~new_value~currency~state_pol")
 *   (new_value keeps one decimal when the second decimal is 0, e.g. 150000.0)
 * These helpers are unit tested so the remaining work is the HTTP plumbing.
 */

export const PAYU_IMPLEMENTED = false;

export function payuCheckoutUrl(env: "sandbox" | "production") {
  return env === "production"
    ? "https://checkout.payulatam.com/ppp-web-gateway-payu/"
    : "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/";
}

const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

export function payuRequestSignature(apiKey: string, merchantId: string, reference: string, amount: number, currency = "COP") {
  return md5(`${apiKey}~${merchantId}~${reference}~${amount}~${currency}`);
}

/** PayU's rounding rule for the confirmation signature value. */
export function payuConfirmationValue(value: number | string): string {
  const n = Number(value);
  const fixed2 = n.toFixed(2);
  return fixed2.endsWith("0") ? n.toFixed(1) : fixed2;
}

export function payuConfirmationSignature(apiKey: string, merchantId: string, reference: string, value: number | string, currency: string, statePol: string) {
  return md5(`${apiKey}~${merchantId}~${reference}~${payuConfirmationValue(value)}~${currency}~${statePol}`);
}

/** state_pol: 4 approved, 6 declined, 5 expired, 7 pending */
export function mapPayuState(statePol: string): "approved" | "declined" | "voided" | "pending" | "error" {
  return ({ "4": "approved", "6": "declined", "5": "voided", "7": "pending" } as Record<string, "approved" | "declined" | "voided" | "pending">)[statePol] ?? "error";
}
