"use client";
import { useState } from "react";
import type { AvailabilityStatus, Product } from "@/types/domain";
import { availabilityLabel, productAvailability } from "@/services/availability";
import { cn, discountPercent, formatCOP } from "@/lib/format";
import { useCart } from "@/features/cart/store";
import { PlusIcon, CloseIcon } from "@/components/icons";

export function AvailabilityBadge({ status, leadTimeDays, className }: { status: AvailabilityStatus; leadTimeDays?: number | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.18em]", className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "available_now" && "bg-emerald-400",
          status === "available_on_order" && "bg-amber-300",
          status === "sold_out" && "bg-smoke",
        )}
        aria-hidden
      />
      <span className={status === "sold_out" ? "text-smoke" : "text-bone/80"}>
        {availabilityLabel[status]}
        {status === "available_on_order" && leadTimeDays ? ` · ${leadTimeDays} DÍAS` : ""}
      </span>
    </span>
  );
}

export function Price({ price, compareAt, className }: { price: number; compareAt: number | null; className?: string }) {
  const pct = discountPercent(price, compareAt);
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span>{formatCOP(price)}</span>
      {pct && compareAt && (
        <>
          <s className="text-[0.8em] text-smoke" aria-label={`Antes ${formatCOP(compareAt)}`}>{formatCOP(compareAt)}</s>
          <span className="text-[0.7em] text-crimson">-{pct}%</span>
        </>
      )}
    </span>
  );
}

export function ProductFlags({ product }: { product: Product }) {
  const sale = discountPercent(product.price, product.compareAtPrice);
  return (
    <span className="flex gap-1.5">
      {product.isDemo && <Flag className="bg-paper text-ink">DEMO</Flag>}
      {product.isNew && <Flag className="border border-paper/40 text-paper">NEW</Flag>}
      {sale && <Flag className="bg-wine text-paper">SALE</Flag>}
    </span>
  );
}

function Flag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("px-2 py-1 font-display text-[9px] font-semibold tracking-[0.2em]", className)}>{children}</span>;
}

/** Round "+" button that opens a size picker and adds the chosen variant to the cart. */
export function QuickAdd({ product, className }: { product: Product; className?: string }) {
  const [open, setOpen] = useState(false);
  const add = useCart((s) => s.add);
  const soldOut = productAvailability(product) === "sold_out";
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        disabled={soldOut}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={soldOut ? `${product.name} agotado` : `Añadir ${product.name} al carrito`}
        aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-full border border-paper/30 bg-ink/40 text-paper backdrop-blur transition-colors hover:border-crimson hover:bg-crimson disabled:opacity-30"
      >
        {open ? <CloseIcon width={16} /> : <PlusIcon width={16} />}
      </button>
      {open && (
        <div
          className="absolute bottom-14 right-0 z-20 w-56 border border-line bg-coal p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="group"
          aria-label="Elige tu talla"
        >
          <p className="eyebrow mb-2">Talla (EU)</p>
          <div className="grid grid-cols-4 gap-1.5">
            {product.variants.map((v) => {
              const out = v.availability.status === "sold_out";
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  title={availabilityLabel[v.availability.status]}
                  onClick={() => {
                    add({
                      variantId: v.id,
                      productId: product.id,
                      slug: product.slug,
                      name: product.name,
                      brand: product.brand.name,
                      sku: v.sku,
                      size: v.size,
                      color: v.color,
                      price: v.price ?? product.price,
                      compareAtPrice: (v.price ?? product.price) === product.price ? product.compareAtPrice : null,
                      image: product.images[0]?.url ?? null,
                      isDemo: product.isDemo,
                      availability: v.availability.status,
                      leadTimeDays: v.availability.leadTimeDays,
                    });
                    setOpen(false);
                  }}
                  className={cn(
                    "h-9 border text-xs",
                    out ? "border-line text-smoke line-through" : "border-paper/25 text-paper hover:border-crimson hover:bg-crimson",
                    v.availability.status === "available_on_order" && "border-dashed",
                  )}
                >
                  {v.size}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-smoke">Borde punteado: bajo pedido.</p>
        </div>
      )}
    </div>
  );
}

/** Shown when a real product has no photo yet. Never replaced with a stand-in image of another shoe. */
export function NoPhoto({ brand, compact }: { brand?: string; compact?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
      <div>
        {brand && <p className={cn("font-display font-bold uppercase tracking-tight text-paper/10", compact ? "text-2xl" : "text-5xl md:text-7xl")}>{brand}</p>}
        <p className={cn("mt-2 uppercase tracking-[0.25em] text-smoke", compact ? "text-[9px]" : "text-[11px]")}>Foto en producción</p>
      </div>
    </div>
  );
}
