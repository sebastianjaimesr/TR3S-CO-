"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletter, type NewsletterState } from "@/features/newsletter/actions";
import { toast } from "@/features/ui/toast";
import { ArrowIcon } from "@/components/icons";

/** Newsletter sign-up with explicit consent (Ley 1581 de 2012). */
export function Newsletter() {
  const [state, action, pending] = useActionState<NewsletterState | null, FormData>(subscribeNewsletter, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    toast(state.ok ? "Suscripción confirmada" : "No se pudo suscribir", { description: state.message, tone: state.ok ? "success" : "error" });
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <section aria-labelledby="newsletter-title" className="relative isolate overflow-hidden border-t border-line bg-crimson text-paper">
      <p aria-hidden className="headline pointer-events-none absolute -bottom-8 -right-4 select-none whitespace-nowrap text-[30vw] leading-none text-ink/15 md:text-[18vw]">DROP</p>
      <div className="relative mx-auto grid max-w-[1600px] gap-10 px-4 py-20 md:px-8 md:py-24 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-6">
          <p className="mb-3 font-display text-[11px] tracking-[0.28em] text-paper/80">NEWSLETTER</p>
          <h2 id="newsletter-title" className="headline text-5xl md:text-7xl">Entérate primero.</h2>
          <p className="mt-4 max-w-md text-base text-paper/85">Lanzamientos, reposiciones y drops de TR3S &amp; CO. Solo correos que valen la pena; te das de baja cuando quieras.</p>
        </div>
        <form ref={form} action={action} className="lg:col-span-6" noValidate>
          <label htmlFor="nl-email" className="sr-only">Correo electrónico</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" className="min-h-14 flex-1 border border-ink/30 bg-paper px-4 text-base text-ink placeholder:text-ink/45 focus:border-ink focus:outline-none" />
            <button type="submit" disabled={pending} className="btn group min-h-14 gap-3 bg-ink px-8 text-paper hover:bg-ink/85 disabled:opacity-60">
              {pending ? "Enviando…" : "Suscribirme"} <ArrowIcon className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          {/* honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <label className="mt-4 flex items-start gap-3 text-xs leading-relaxed text-paper/90">
            <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-[#050505]" />
            <span>
              Autorizo a TR3S &amp; CO. a usar mi correo para enviarme novedades, según la{" "}
              <Link href="/policies/privacidad" className="underline underline-offset-2">política de tratamiento de datos</Link>.
            </span>
          </label>
          {state && !state.ok && <p role="alert" className="mt-3 text-sm font-semibold text-paper">{state.message}</p>}
        </form>
      </div>
    </section>
  );
}
