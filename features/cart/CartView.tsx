"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart, cartTotals, MAX_QTY } from "@/features/cart/store";
import { useHydrated } from "@/hooks/useHydrated";
import { formatCOP } from "@/lib/format";
import { availabilityLabel } from "@/services/availability";
import { cartSummaryMessage, whatsappLink } from "@/services/whatsapp";
import { WhatsappIcon } from "@/components/icons";

export function CartView({ shippingFlatRate, freeShippingFrom, whatsappNumber }: { shippingFlatRate: number; freeShippingFrom: number | null; whatsappNumber: string | null }) {
  const hydrated = useHydrated();
  const { items, remove, setQuantity } = useCart();
  if (!hydrated) return <div className="mt-10 h-64 animate-pulse bg-coal" aria-busy="true" />;
  const t = cartTotals(items, shippingFlatRate, freeShippingFrom);
  const hasDemo = items.some((i) => i.isDemo);
  const wa = whatsappLink(whatsappNumber, cartSummaryMessage(items, t.subtotal));

  if (items.length === 0)
    return (
      <div className="mt-10 border border-line p-12 text-center">
        <p className="font-display text-2xl">Tu carrito está vacío.</p>
        <Link href="/shop" className="btn btn-primary mt-6">Ir a la tienda</Link>
      </div>
    );

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-12">
      <ul className="divide-y divide-line border-y border-line lg:col-span-8">
        {items.map((i) => (
          <li key={i.variantId} className="flex gap-4 py-5">
            <Link href={`/product/${i.slug}`} className="relative h-28 w-28 shrink-0 bg-coal">
              {i.image && <Image src={i.image} alt={i.name} fill sizes="112px" className="object-contain p-2" />}
            </Link>
            <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{i.brand}</p>
                <Link href={`/product/${i.slug}`} className="font-display text-lg">{i.name}</Link>
                <p className="text-sm text-smoke">Talla {i.size} · {i.color} · Ref. {i.sku}</p>
                <p className="text-[11px] tracking-[0.15em] text-smoke">
                  {i.isDemo ? <span className="text-crimson">DEMO · NO DISPONIBLE PARA COMPRA</span> : availabilityLabel[i.availability]}
                  {i.availability === "available_on_order" && i.leadTimeDays ? ` · ENTREGA ESTIMADA ${i.leadTimeDays} DÍAS + ENVÍO` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="sr-only" htmlFor={`qty-${i.variantId}`}>Cantidad</label>
                <select id={`qty-${i.variantId}`} value={i.quantity} onChange={(e) => setQuantity(i.variantId, Number(e.target.value))} className="field h-10 min-h-0 w-20 py-0">
                  {Array.from({ length: MAX_QTY }, (_, n) => n + 1).map((n) => <option key={n}>{n}</option>)}
                </select>
                <p className="w-28 text-right font-display">{formatCOP(i.price * i.quantity)}</p>
                <button type="button" onClick={() => remove(i.variantId)} className="text-xs text-smoke underline hover:text-paper">Eliminar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <aside className="h-fit border border-line bg-coal p-6 lg:col-span-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-bone/70"><dt>Subtotal</dt><dd>{formatCOP(t.subtotal)}</dd></div>
          <div className="flex justify-between text-bone/70"><dt>Envío</dt><dd>{t.shipping === 0 ? "Gratis" : formatCOP(t.shipping)}</dd></div>
          {freeShippingFrom && t.subtotal < freeShippingFrom && (
            <p className="text-xs text-smoke">Te faltan {formatCOP(freeShippingFrom - t.subtotal)} para envío gratis.</p>
          )}
          <div className="flex justify-between border-t border-line pt-3 font-display text-xl"><dt>Total</dt><dd>{formatCOP(t.total)}</dd></div>
        </dl>
        {hasDemo && <p className="mt-4 text-sm text-crimson">Tu carrito tiene productos DEMO: elimínalos para pagar.</p>}
        {hasDemo ? (
          <span aria-disabled="true" className="btn btn-primary mt-6 w-full">Ir al checkout</span>
        ) : (
          <Link href="/checkout" className="btn btn-primary mt-6 w-full">Ir al checkout</Link>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-2 w-full">
            <WhatsappIcon width={16} /> Comprar por WhatsApp
          </a>
        )}
      </aside>
    </div>
  );
}
