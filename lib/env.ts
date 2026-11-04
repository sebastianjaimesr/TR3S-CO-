/**
 * Centralized environment access. Public values use NEXT_PUBLIC_ prefix;
 * everything else is server-only and must never be imported into client code.
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Wompi's public key is not secret, but it is only used on the server. */
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY || "",
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  /** Fallback only; the admin-configured number in store_settings wins. */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export type PaymentEnvironment = "sandbox" | "production";

const envName = (v: string | undefined): PaymentEnvironment => (v === "production" ? "production" : "sandbox");

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must only be called on the server");
  }
  return {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
    wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
    wompiEnv: envName(process.env.WOMPI_ENVIRONMENT || process.env.WOMPI_ENV),
    mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
    mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
    mercadoPagoEnv: envName(process.env.MERCADOPAGO_ENVIRONMENT),
    payuApiKey: process.env.PAYU_API_KEY ?? "",
    payuMerchantId: process.env.PAYU_MERCHANT_ID ?? "",
    payuAccountId: process.env.PAYU_ACCOUNT_ID ?? "",
    payuEnv: envName(process.env.PAYU_ENVIRONMENT),
  };
}

/** Wompi keys carry their environment in the prefix (pub_test_ / pub_prod_). */
export function wompiKeyEnvironment(publicKey: string): PaymentEnvironment | null {
  if (publicKey.startsWith("pub_test_")) return "sandbox";
  if (publicKey.startsWith("pub_prod_")) return "production";
  return null;
}

export function isWompiConfigured(): boolean {
  const s = serverEnv();
  return Boolean(
    publicEnv.wompiPublicKey &&
      s.wompiIntegritySecret &&
      s.wompiEventsSecret &&
      wompiKeyEnvironment(publicEnv.wompiPublicKey) === s.wompiEnv,
  );
}

/** Mercado Pago test credentials start with TEST-, production ones with APP_USR-. */
export function mercadoPagoTokenEnvironment(token: string): PaymentEnvironment | null {
  if (token.startsWith("TEST-")) return "sandbox";
  if (token.startsWith("APP_USR-")) return "production";
  return null;
}

export function isMercadoPagoConfigured(): boolean {
  const s = serverEnv();
  return Boolean(s.mercadoPagoAccessToken && s.mercadoPagoWebhookSecret);
}
