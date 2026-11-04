"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const creds = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8, "Mínimo 8 caracteres").max(72) });
const safeNext = (n: FormDataEntryValue | null) => {
  const s = String(n ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/account";
};

export async function signIn(_: unknown, form: FormData): Promise<{ error?: string; info?: string }> {
  const p = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) return { error: "Correo o contraseña inválidos." };
  // Brute-force guard per account and per IP (a shared office IP still gets room).
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}:${p.data.email}`, 8, 10 * 60_000).ok || !rateLimit(`login:${ip}`, 40, 10 * 60_000).ok)
    return { error: "Demasiados intentos. Espera unos minutos." };
  const sb = await supabaseServer();
  if (!sb) return { error: "La autenticación se habilita al conectar Supabase." };
  const { error } = await sb.auth.signInWithPassword(p.data);
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: unknown, form: FormData): Promise<{ error?: string; info?: string }> {
  if (!rateLimit(`signup:${await clientIp()}`, 5, 10 * 60_000).ok) return { error: "Demasiados intentos. Espera unos minutos." };
  const p = creds.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const sb = await supabaseServer();
  if (!sb) return { error: "La autenticación se habilita al conectar Supabase." };
  const { data, error } = await sb.auth.signUp({ ...p.data, options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` } });
  if (error) return { error: "No pudimos crear la cuenta." };
  // Email confirmation disabled in the project: the user already has a session.
  if (data.session) redirect(safeNext(form.get("next")));
  return { info: "Te enviamos un correo para confirmar tu cuenta." };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb?.auth.signOut();
  redirect("/");
}
