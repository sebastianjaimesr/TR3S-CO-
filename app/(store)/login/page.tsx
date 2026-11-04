import type { Metadata } from "next";
import { LoginForms } from "@/features/account/LoginForms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl font-bold tracking-tight">MI CUENTA</h1>
      {!isSupabaseConfigured() && (
        <p className="mt-6 border border-crimson/40 bg-wine/10 p-4 text-sm">Las cuentas se activan cuando el administrador conecta Supabase.</p>
      )}
      <LoginForms next={next ?? "/account"} />
    </div>
  );
}
