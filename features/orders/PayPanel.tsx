"use client";
import { useState, useTransition } from "react";
import { acceptShippingQuote, payOrder } from "@/features/checkout/actions";
import { cn, formatCOP } from "@/lib/format";
import type { PaymentMethodId } from "@/types/domain";

interface ProviderOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  sandbox: boolean;
}

/** Lets the customer pay, retry a declined payment, or switch method — always through the server. */
export function PayPanel({ number, token, total, providers, current, retry }: { number: string; token: string; total: number; providers: ProviderOption[]; current: string; retry: boolean }) {
  const [method, setMethod] = useState<string>(providers.find((p) => p.id === current)?.id ?? providers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!providers.length) return <p className="text-sm text-smoke">No hay métodos de pago habilitados en este momento. Escríbenos por WhatsApp.</p>;
  return (
    <div>
      <div className="space-y-2" role="radiogroup" aria-label="Método de pago">
        {providers.map((p) => (
          <label key={p.id} className={cn("flex cursor-pointer gap-3 border p-3 text-sm", method === p.id ? "border-paper bg-graphite/40" : "border-line")}>
            <input type="radio" name="method" checked={method === p.id} onChange={() => setMethod(p.id)} className="mt-1 accent-[#d50025]" />
            <span>
              <span className="font-display font-semibold">{p.label}</span>
              {p.sandbox && <span className="ml-2 text-[9px] tracking-[0.15em] text-amber-300">MODO PRUEBAS</span>}
              <span className="block text-xs text-smoke">{p.description}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-crimson">{error}</p>}
      <button
        type="button"
        disabled={pending || !method}
        className="btn btn-primary mt-4 w-full"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await payOrder(number, token, method);
            if (r.ok) window.location.assign(r.redirectUrl);
            else setError(r.error);
          })
        }
      >
        {pending ? "Conectando…" : method === "transfer" ? "Pagar por transferencia" : `${retry ? "Reintentar pago" : "Pagar"} ${formatCOP(total)}`}
      </button>
    </div>
  );
}

export function AcceptQuote({ number, token, shipping, total }: { number: string; token: string; shipping: number; total: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <p className="text-sm text-bone/80">
        Envío cotizado: <strong className="text-paper">{formatCOP(shipping)}</strong> · Nuevo total <strong className="text-paper">{formatCOP(total)}</strong>
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-crimson">{error}</p>}
      <button
        type="button"
        disabled={pending}
        className="btn btn-primary mt-4 w-full"
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await acceptShippingQuote(number, token);
            if (r.ok) window.location.assign(r.redirectUrl);
            else setError(r.error);
          })
        }
      >
        {pending ? "Guardando…" : "Aceptar envío y continuar al pago"}
      </button>
      <p className="mt-2 text-xs text-smoke">Si no te sirve, no hagas nada: la reserva vence sola y no se te cobra.</p>
    </div>
  );
}
