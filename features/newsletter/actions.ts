"use server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export interface NewsletterState {
  ok: boolean;
  message: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(120),
  consent: z.literal("on", { message: "Debes aceptar el tratamiento de datos para suscribirte." }),
  // honeypot: real people never fill it
  website: z.string().max(0).optional().default(""),
});

export async function subscribeNewsletter(_: NewsletterState | null, form: FormData): Promise<NewsletterState> {
  const rl = rateLimit(`newsletter:${await clientIp()}`, 5, 10 * 60_000);
  if (!rl.ok) return { ok: false, message: "Demasiados intentos. Intenta de nuevo en unos minutos." };
  const parsed = schema.safeParse({ email: form.get("email"), consent: form.get("consent"), website: form.get("website") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const sb = await supabaseServer();
  if (!sb) return { ok: false, message: "La suscripción estará disponible cuando la tienda conecte su base de datos." };
  const { error } = await sb.rpc("subscribe_newsletter", { p_email: parsed.data.email, p_source: "home" });
  if (error) return { ok: false, message: "No pudimos registrar tu correo. Intenta más tarde." };
  return { ok: true, message: "Listo. Te avisaremos de lanzamientos y drops antes que a nadie." };
}
