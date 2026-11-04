"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useCart, cartTotals } from "@/features/cart/store";
import { useHydrated } from "@/hooks/useHydrated";
import { departments } from "@/validations/checkout";
import { placeOrder } from "@/features/checkout/actions";
import { formatCOP, cn } from "@/lib/format";
import { availabilityLabel } from "@/services/availability";

interface Props {
  shippingFlatRate: number;
  freeShippingFrom: number | null;
  methods: { wompi: boolean; transfer: boolean };
  ready: { database: boolean; wompi: boolean };
}

export function CheckoutForm({ shippingFlatRate, freeShippingFrom, methods, ready }: Props) {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, ""));
  const availableMethods = [
    methods.wompi && ready.wompi && { v: "wompi", l: "Wompi", d: "Tarjeta, PSE, Nequi, Bancolombia. Pago seguro en la plataforma de Wompi." },
    methods.transfer && { v: "transfer", l: "Transferencia bancaria", d: "Reservamos tu pedido 48 h mientras confirmamos el pago." },
  ].filter(Boolean) as { v: "wompi" | "transfer"; l: string; d: string }[];
  const [method, setMethod] = useState<"wompi" | "transfer" | "">(availableMethods[0]?.v ?? "");

  if (!hydrated) return <div className="h-96" aria-busy="true" />;

  const t = cartTotals(items, shippingFlatRate, freeShippingFrom);
  const hasDemo = items.some((i) => i.isDemo);
  const hasOnOrder = items.some((i) => i.availability === "available_on_order");

  if (items.length === 0) {
    return (
      <div className="border border-line p-12 text-center">
        <p className="font-display text-2xl">Tu carrito está vacío.</p>
        <Link href="/shop" className="btn btn-primary mt-6">Ir a la tienda</Link>
      </div>
    );
  }

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
        department: String(f.get("department") ?? "") as (typeof departments)[number],
        city: String(f.get("city") ?? ""),
        address: String(f.get("address") ?? ""),
        addressNotes: String(f.get("addressNotes") ?? ""),
        paymentMethod: method as "wompi" | "transfer",
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

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-12" noValidate>
      <div className="space-y-10 lg:col-span-7">
        {!ready.database && (
          <p role="status" className="border border-crimson/40 bg-wine/10 p-4 text-sm">
            Modo DEMO: la base de datos no está conectada, así que este checkout no puede crear pedidos reales.
          </p>
        )}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 font-display text-lg font-semibold">1. Tus datos</legend>
          {field("firstName", "Nombre", { autoComplete: "given-name", required: true })}
          {field("lastName", "Apellidos", { autoComplete: "family-name", required: true })}
          {field("email", "Correo", { type: "email", autoComplete: "email", required: true })}
          {field("phone", "Celular", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "300 000 0000", required: true })}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 font-display text-lg font-semibold">2. Envío</legend>
          <div>
            <label htmlFor="department" className="field-label">Departamento</label>
            <select id="department" name="department" defaultValue="Santander" className={cn("field", fieldErrors.department && "border-crimson")}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
            {fe("department")}
          </div>
          {field("city", "Ciudad", { autoComplete: "address-level2", defaultValue: "Bucaramanga", required: true })}
          {field("address", "Dirección", { autoComplete: "street-address", required: true }, "sm:col-span-2")}
          {field("addressNotes", "Información adicional (opcional)", { placeholder: "Apto, torre, barrio, referencias" }, "sm:col-span-2")}
        </fieldset>
        <fieldset>
          <legend className="mb-4 font-display text-lg font-semibold">3. Método de pago</legend>
          {availableMethods.length === 0 ? (
            <p className="text-sm text-smoke">No hay métodos de pago habilitados todavía.</p>
          ) : (
            <div className="space-y-2">
              {availableMethods.map((m) => (
                <label key={m.v} className={cn("flex cursor-pointer gap-4 border p-4", method === m.v ? "border-paper" : "border-line")}>
                  <input type="radio" name="paymentMethod" value={m.v} checked={method === m.v} onChange={() => setMethod(m.v)} className="mt-1 accent-[#a52632]" />
                  <span>
                    <span className="block font-display font-semibold">{m.l}</span>
                    <span className="block text-sm text-smoke">{m.d}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-smoke">Nunca almacenamos datos de tarjetas.</p>
        </fieldset>
        <div>
          {field("couponCode", "Cupón (opcional)", { autoComplete: "off" })}
        </div>
        <label className="flex items-start gap-3 text-sm text-bone/80">
          <input type="checkbox" name="acceptPolicies" className="mt-1 h-4 w-4 accent-[#a52632]" />
          <span>
            Acepto los <Link href="/policies/terminos" className="underline" target="_blank">términos</Link>, la{" "}
            <Link href="/policies/privacidad" className="underline" target="_blank">política de datos</Link> y la{" "}
            <Link href="/policies/cambios-y-devoluciones" className="underline" target="_blank">política de cambios</Link>.
          </span>
        </label>
        {fe("acceptPolicies")}
      </div>

      <aside className="lg:col-span-5">
        <div className="border border-line bg-coal p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">Resumen</h2>
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
            <div className="flex justify-between text-bone/70"><dt>Subtotal</dt><dd>{formatCOP(t.subtotal)}</dd></div>
            <div className="flex justify-between text-bone/70"><dt>Envío</dt><dd>{t.shipping === 0 ? "Gratis" : formatCOP(t.shipping)}</dd></div>
            <div className="flex justify-between font-display text-lg"><dt>Total</dt><dd>{formatCOP(t.total)}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-smoke">El total final lo calcula el servidor con los precios vigentes y los cupones válidos.</p>
          {hasOnOrder && (
            <p className="mt-4 border border-line p-3 text-xs text-bone/80">
              Tu pedido incluye productos bajo pedido: confirmaremos con el proveedor antes de despacharlos. Si no hay disponibilidad, te devolvemos el dinero.
            </p>
          )}
          {hasDemo && <p className="mt-4 text-sm text-crimson">Elimina los productos DEMO del carrito para continuar.</p>}
          {error && <p role="alert" className="mt-4 border border-crimson/50 p-3 text-sm text-crimson">{error}</p>}
          <button type="submit" disabled={pending || hasDemo || !method || !ready.database} className="btn btn-primary mt-6 w-full">
            {pending ? "Procesando…" : method === "wompi" ? "Pagar con Wompi" : "Confirmar pedido"}
          </button>
        </div>
      </aside>
    </form>
  );
}
