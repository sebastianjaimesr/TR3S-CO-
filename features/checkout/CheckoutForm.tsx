"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useCart, cartTotals } from "@/features/cart/store";
import { useHydrated } from "@/hooks/useHydrated";
import { departments } from "@/validations/checkout";
import { estimateShipping, placeOrder, type ShippingEstimate } from "@/features/checkout/actions";
import { formatCOP, cn } from "@/lib/format";
import { availabilityLabel } from "@/services/availability";
import { EmptyCart } from "@/features/cart/EmptyCart";
import type { PaymentMethodId } from "@/types/domain";

interface ProviderOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  sandbox: boolean;
}

interface Props {
  shippingFlatRate: number;
  freeShippingFrom: number | null;
  providers: ProviderOption[];
  databaseReady: boolean;
}

export function CheckoutForm({ shippingFlatRate, freeShippingFrom, providers, databaseReady }: Props) {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, ""));
  const [method, setMethod] = useState<PaymentMethodId | "">(providers[0]?.id ?? "");
  const [department, setDepartment] = useState("Santander");
  const [city, setCity] = useState("Bucaramanga");
  const [estimate, setEstimate] = useState<ShippingEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const t = cartTotals(items, shippingFlatRate, freeShippingFrom);

  useEffect(() => {
    if (!databaseReady || !items.length) return;
    let alive = true;
    setEstimating(true);
    const id = setTimeout(async () => {
      const r = await estimateShipping(department, city, t.subtotal).catch(() => null);
      if (alive) {
        setEstimate(r);
        setEstimating(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [department, city, t.subtotal, databaseReady, items.length]);

  if (!hydrated) return <div className="h-96 animate-pulse bg-coal" aria-busy="true" />;

  const hasDemo = items.some((i) => i.isDemo);
  const hasOnOrder = items.some((i) => i.availability === "available_on_order");

  if (items.length === 0) return <EmptyCart />;

  const shipping = estimate ? (estimate.requiresQuote ? null : estimate.amount ?? 0) : t.shipping;
  const requiresQuote = Boolean(estimate?.requiresQuote);
  const total = t.subtotal + (shipping ?? 0);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = await placeOrder({
        firstName: String(f.get("firstName") ?? ""),
        lastName: String(f.get("lastName") ?? ""),
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
        department: department as (typeof departments)[number],
        city,
        address: String(f.get("address") ?? ""),
        addressNotes: String(f.get("addressNotes") ?? ""),
        paymentMethod: method as PaymentMethodId,
        couponCode: String(f.get("couponCode") ?? ""),
        acceptPolicies: f.get("acceptPolicies") === "on" ? true : (false as unknown as true),
        idempotencyKey,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      clear();
      window.location.assign(res.redirectUrl);
    });
  };

  const fe = (k: string) => fieldErrors[k] && <p className="mt-1 text-xs text-crimson" id={`${k}-error`}>{fieldErrors[k]}</p>;
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = "") => (
    <div className={span}>
      <label htmlFor={name} className="field-label">{label}</label>
      <input id={name} name={name} className={cn("field", fieldErrors[name] && "border-crimson")} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] ? `${name}-error` : undefined} {...props} />
      {fe(name)}
    </div>
  );

  const submitLabel = pending
    ? "Procesando…"
    : requiresQuote
      ? "Enviar pedido para cotizar envío"
      : method === "transfer"
        ? "Confirmar pedido"
        : `Pagar con ${providers.find((p) => p.id === method)?.label ?? "…"}`;

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-12" noValidate>
      <div className="space-y-10 lg:col-span-7">
        {!databaseReady && (
          <p role="status" className="border border-crimson/40 bg-wine/10 p-4 text-sm">
            La base de datos no está conectada en este entorno: este checkout no puede crear pedidos.
          </p>
        )}
        <Step n={1} title="Tus datos">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("firstName", "Nombre", { autoComplete: "given-name", required: true })}
            {field("lastName", "Apellidos", { autoComplete: "family-name", required: true })}
            {field("email", "Correo", { type: "email", autoComplete: "email", required: true })}
            {field("phone", "Celular", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "300 000 0000", required: true })}
          </div>
        </Step>
        <Step n={2} title="Entrega">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="department" className="field-label">Departamento</label>
              <select id="department" name="department" value={department} onChange={(e) => setDepartment(e.target.value)} className={cn("field", fieldErrors.department && "border-crimson")}>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </select>
              {fe("department")}
            </div>
            {field("city", "Ciudad", { autoComplete: "address-level2", value: city, onChange: (e) => setCity(e.target.value), required: true })}
            {field("address", "Dirección", { autoComplete: "street-address", required: true }, "sm:col-span-2")}
            {field("addressNotes", "Información adicional (opcional)", { placeholder: "Apto, torre, barrio, referencias" }, "sm:col-span-2")}
          </div>
          <div className="mt-4 border border-line bg-coal/60 p-4 text-sm" aria-live="polite">
            {estimating ? (
              <p className="text-smoke">Calculando envío…</p>
            ) : requiresQuote ? (
              <p>
                <strong className="text-paper">Envío por cotizar.</strong>{" "}
                <span className="text-bone/70">Para esta zona cotizamos el envío a mano. Recibes el valor y solo pagas cuando lo aceptes; tu pedido queda reservado mientras tanto.</span>
              </p>
            ) : (
              <p className="flex flex-wrap justify-between gap-2">
                <span className="text-bone/70">Envío{estimate?.zone ? ` · ${estimate.zone}` : ""}{estimate?.eta ? ` · ${estimate.eta}` : ""}</span>
                <span className="font-display text-paper">{shipping === 0 ? "Gratis" : formatCOP(shipping ?? 0)}</span>
              </p>
            )}
          </div>
        </Step>
        <Step n={3} title="Método de pago">
          {providers.length === 0 ? (
            <p className="border border-line p-4 text-sm text-smoke">Todavía no hay métodos de pago habilitados. Escríbenos por WhatsApp para comprar.</p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Método de pago">
              {providers.map((m) => (
                <label key={m.id} className={cn("flex cursor-pointer gap-4 border p-4 transition-colors", method === m.id ? "border-paper bg-graphite/40" : "border-line hover:border-paper/40")}>
                  <input type="radio" name="paymentMethod" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[#d50025]" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-display font-semibold">
                      {m.label}
                      {m.sandbox && <span className="border border-amber-300/40 px-1.5 py-0.5 text-[9px] tracking-[0.15em] text-amber-300">MODO PRUEBAS</span>}
                    </span>
                    <span className="block text-sm text-smoke">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {fe("paymentMethod")}
          <p className="mt-3 text-xs text-smoke">Nunca vemos ni almacenamos los datos de tu tarjeta: el pago ocurre en la plataforma del proveedor.</p>
        </Step>
        <div>{field("couponCode", "Cupón (opcional)", { autoComplete: "off" })}</div>
        <label className="flex items-start gap-3 text-sm text-bone/80">
          <input type="checkbox" name="acceptPolicies" className="mt-1 h-4 w-4 accent-[#d50025]" />
          <span>
            Acepto los <Link href="/policies/terminos" className="underline" target="_blank">términos</Link>, la{" "}
            <Link href="/policies/privacidad" className="underline" target="_blank">política de datos</Link> y la{" "}
            <Link href="/policies/cambios-y-devoluciones" className="underline" target="_blank">política de cambios</Link>.
          </span>
        </label>
        {fe("acceptPolicies")}
      </div>

      <aside className="lg:col-span-5">
        <div className="border border-line bg-coal p-6 lg:sticky lg:top-28">
          <h2 className="font-display text-lg font-semibold tracking-tight">Resumen</h2>
          <ul className="mt-4 divide-y divide-line">
            {items.map((i) => (
              <li key={i.variantId} className="flex gap-3 py-3">
                <div className="relative h-16 w-16 shrink-0 bg-graphite">
                  {i.image && <Image src={i.image} alt="" fill sizes="64px" className="object-contain p-1" />}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{i.quantity} × {i.brand} {i.name}</p>
                  <p className="text-xs text-smoke">Talla {i.size} · {i.color}</p>
                  <p className={cn("text-[10px] tracking-[0.15em]", i.isDemo ? "text-crimson" : "text-smoke")}>
                    {i.isDemo ? "DEMO · NO SE PUEDE COMPRAR" : availabilityLabel[i.availability]}
                    {i.availability === "available_on_order" && i.leadTimeDays ? ` · ~${i.leadTimeDays} DÍAS` : ""}
                  </p>
                </div>
                <p className="text-sm">{formatCOP(i.price * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-bone/70"><dt>Subtotal ({t.count} {t.count === 1 ? "artículo" : "artículos"})</dt><dd>{formatCOP(t.subtotal)}</dd></div>
            <div className="flex justify-between text-bone/70"><dt>Envío</dt><dd>{requiresQuote ? "Por cotizar" : shipping === 0 ? "Gratis" : formatCOP(shipping ?? 0)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 font-display text-xl"><dt>Total</dt><dd>{formatCOP(total)}{requiresQuote ? " + envío" : ""}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-smoke">El total final lo calcula el servidor con los precios vigentes, el envío de tu zona y los cupones válidos.</p>
          {hasOnOrder && (
            <p className="mt-4 border border-line p-3 text-xs text-bone/80">
              Tu pedido incluye productos bajo pedido: confirmaremos con el proveedor antes de despacharlos. Si no hay disponibilidad, te devolvemos el dinero.
            </p>
          )}
          {hasDemo && <p className="mt-4 text-sm text-crimson">Elimina los productos DEMO del carrito para continuar.</p>}
          {error && <p role="alert" className="mt-4 border border-crimson/50 p-3 text-sm text-crimson">{error}</p>}
          <button type="submit" disabled={pending || hasDemo || !method || !databaseReady} className="btn btn-primary mt-6 w-full">
            {submitLabel}
          </button>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-5 flex items-center gap-3 font-display text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-crimson text-xs text-paper">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
