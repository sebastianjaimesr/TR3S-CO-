"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, cartTotals } from "@/features/cart/store";
import { CloseIcon, MinusIcon, PlusIcon, WhatsappIcon } from "@/components/icons";
import { formatCOP } from "@/lib/format";
import { availabilityLabel } from "@/services/availability";
import { cartSummaryMessage, whatsappLink } from "@/services/whatsapp";
import { useHydrated } from "@/hooks/useHydrated";
import { EmptyCart } from "@/features/cart/EmptyCart";

export function CartDrawer({ whatsappNumber, shippingFlatRate, freeShippingFrom }: { whatsappNumber: string | null; shippingFlatRate: number; freeShippingFrom: number | null }) {
  const { items, open, setOpen, remove, setQuantity } = useCart();
  const hydrated = useHydrated();
  const t = cartTotals(items, shippingFlatRate, freeShippingFrom);
  const hasDemo = items.some((i) => i.isDemo);
  const wa = whatsappLink(whatsappNumber, cartSummaryMessage(items, t.subtotal));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!hydrated) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrito"
            className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-line bg-coal"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.45 }}
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <h2 className="font-display text-sm font-semibold tracking-[0.2em]">CARRITO ({t.count})</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center" aria-label="Cerrar carrito">
                <CloseIcon />
              </button>
            </div>
            {items.length === 0 ? (
              <EmptyCart compact onNavigate={() => setOpen(false)} />
            ) : (
              <>
                <ul className="flex-1 divide-y divide-line overflow-y-auto">
                  {items.map((i) => (
                    <li key={i.variantId} className="flex gap-4 p-5">
                      <div className="relative h-24 w-24 shrink-0 bg-graphite">
                        {i.image && <Image src={i.image} alt={i.name} fill sizes="96px" className="object-contain p-2" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="eyebrow">{i.brand}</p>
                        <Link href={`/product/${i.slug}`} onClick={() => setOpen(false)} className="truncate font-display font-medium text-paper">
                          {i.name}
                        </Link>
                        <p className="text-xs text-smoke">Talla {i.size} · {i.color} · {i.sku}</p>
                        <p className="mt-1 text-[10px] tracking-[0.15em] text-smoke">
                          {i.isDemo ? <span className="text-crimson">DEMO · NO DISPONIBLE PARA COMPRA</span> : availabilityLabel[i.availability]}
                          {i.availability === "available_on_order" && i.leadTimeDays ? ` · ${i.leadTimeDays} días aprox.` : ""}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center border border-line">
                            <button type="button" className="grid h-9 w-9 place-items-center" aria-label="Restar uno" onClick={() => setQuantity(i.variantId, i.quantity - 1)}>
                              <MinusIcon width={14} />
                            </button>
                            <span className="w-8 text-center text-sm" aria-live="polite">{i.quantity}</span>
                            <button type="button" className="grid h-9 w-9 place-items-center" aria-label="Sumar uno" onClick={() => setQuantity(i.variantId, i.quantity + 1)}>
                              <PlusIcon width={14} />
                            </button>
                          </div>
                          <p className="font-display text-sm">{formatCOP(i.price * i.quantity)}</p>
                        </div>
                        <button type="button" onClick={() => remove(i.variantId)} className="mt-2 self-start text-xs text-smoke underline-offset-4 hover:text-paper hover:underline">
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3 border-t border-line p-5">
                  {t.savings > 0 && <Row label="Ahorras" value={`−${formatCOP(t.savings)}`} />}
                  <Row label="Envío" value="Se calcula en el checkout" />
                  <Row label="Subtotal estimado" value={formatCOP(t.subtotal)} strong />
                  {hasDemo && (
                    <p className="border border-crimson/40 bg-wine/10 p-3 text-xs text-bone/80">
                      Los productos DEMO son de demostración y no se pueden comprar. Elimínalos para continuar.
                    </p>
                  )}
                  <Link
                    href="/cart"
                    onClick={() => setOpen(false)}
                    className="btn btn-ghost w-full"
                  >
                    Ver carrito
                  </Link>
                  {hasDemo ? (
                    <span className="btn btn-primary w-full" aria-disabled="true">Checkout</span>
                  ) : (
                    <Link href="/checkout" onClick={() => setOpen(false)} className="btn btn-primary w-full">Checkout</Link>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="btn w-full border border-line text-bone/80 hover:text-paper">
                      <WhatsappIcon width={16} /> Compra asistida por WhatsApp
                    </a>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? "font-display text-base text-paper" : "text-bone/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
