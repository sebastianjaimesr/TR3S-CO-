/**
 * Centralized environment access. Public values use NEXT_PUBLIC_ prefix;
 * everything else is server-only and must never be imported into client code.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  wompiPublicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "",
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  /** Fallback only; the admin-configured number in store_settings wins. */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must only be called on the server");
  }
  return {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
    wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET ?? "",
    wompiEnv: (process.env.WOMPI_ENV === "production" ? "production" : "sandbox") as
      | "production"
      | "sandbox",
  };
}

export function isWompiConfigured(): boolean {
  const s = serverEnv();
  return Boolean(publicEnv.wompiPublicKey && s.wompiIntegritySecret && s.wompiEventsSecret);
}
