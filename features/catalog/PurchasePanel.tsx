"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product } from "@/types/domain";
import { cn } from "@/lib/format";
import { AvailabilityBadge, Price, ProductFlags } from "@/features/catalog/bits";
import { availabilityHelp, productAvailability, shortestLeadTime } from "@/services/availability";
import { useCart } from "@/features/cart/store";
import { useWishlist } from "@/features/wishlist/store";
import { toast } from "@/features/ui/toast";
import { useHydrated } from "@/hooks/useHydrated";
import { productInquiryMessage, whatsappLink } from "@/services/whatsapp";
import { HeartIcon, WhatsappIcon } from "@/components/icons";

export function PurchasePanel({ product, whatsappNumber, initialSize }: { product: Product; whatsappNumber: string | null; initialSize?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const add = useCart((s) => s.add);
  const wished = useWishlist((s) => s.items.some((i) => i.productId === product.id));
  const toggleWish = useWishlist((s) => s.toggle);

  const colors = useMemo(() => [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()], [product.variants]);
  const [color, setColor] = useState(colors[0]?.[0] ?? "");
  const sizes = product.variants.filter((v) => v.color === color);
  const [variantId, setVariantId] = useState<string | null>(
    () => sizes.find((v) => v.size === initialSize && v.availability.status !== "sold_out")?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const status = variant?.availability.status ?? productAvailability(product);
  const price = variant?.price ?? product.price;

  const wa = whatsappLink(
    whatsappNumber,
    productInquiryMessage({ name: product.name, brand: product.brand.name, sku: variant?.sku ?? product.reference, size: variant?.size, color: color || undefined }),
  );

  const doAdd = (buyNow: boolean) => {
    if (!variant) {
      setError("Selecciona una talla.");
      return;
    }
    setError(null);
    add({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price,
      compareAtPrice: (variant.price ?? product.price) === product.price ? product.compareAtPrice : null,
      image: product.images[0]?.url ?? null,
      isDemo: product.isDemo,
      availability: variant.availability.status,
      leadTimeDays: variant.availability.leadTimeDays,
    });
    if (buyNow) {
      useCart.getState().setOpen(false);
      router.push("/checkout");
    }
  };

  const purchasable = !product.isDemo && status !== "sold_out";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">{product.brand.name}</p>
        <ProductFlags product={product} />
      </div>
      <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">{product.name}</h1>
      <p className="mt-2 text-xs text-smoke">Ref. {variant?.sku ?? product.reference}</p>
      <p className="mt-6 font-display text-3xl"><Price price={price} compareAt={product.compareAtPrice} /></p>
      <div className="mt-4">
        <AvailabilityBadge status={status} leadTimeDays={variant?.availability.leadTimeDays ?? shortestLeadTime(product)} />
        <p className="mt-1 text-xs text-smoke">{availabilityHelp[status]}</p>
      </div>

      {product.isDemo && (
        <p className="mt-6 border border-crimson/40 bg-wine/10 p-4 text-sm text-bone/85">
          Este es un producto DEMO para mostrar la experiencia de la tienda. No es una referencia real y no se puede comprar.
        </p>
      )}

      {colors.length > 0 && (
        <fieldset className="mt-8">
          <legend className="eyebrow mb-3">Color: <span className="text-paper">{color}</span></legend>
          <div className="flex gap-2">
            {colors.map(([c, hex]) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === color}
                aria-label={c}
                title={c}
                onClick={() => {
                  setColor(c);
                  setVariantId(null);
                }}
                className={cn("h-10 w-10 rounded-full border-2", c === color ? "border-paper" : "border-line")}
                style={{ background: hex ?? "#444" }}
              />
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <legend className="eyebrow">Talla (EU)</legend>
          <a href="#guia-tallas" className="text-xs text-smoke underline underline-offset-4 hover:text-paper">Guía de tallas</a>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {sizes.map((v) => {
            const out = v.availability.status === "sold_out";
            return (
              <button
                key={v.id}
                type="button"
                disabled={out}
                aria-pressed={v.id === variantId}
                aria-label={`Talla ${v.size}${out ? ", agotada" : v.availability.status === "available_on_order" ? ", bajo pedido" : ""}`}
                onClick={() => {
                  setVariantId(v.id);
                  setError(null);
                }}
                className={cn(
                  "h-12 border text-sm transition-colors",
                  v.id === variantId ? "border-paper bg-paper text-ink" : "border-paper/20 hover:border-paper",
                  out && "cursor-not-allowed border-line text-smoke line-through",
                  !out && v.availability.status === "available_on_order" && v.id !== variantId && "border-dashed",
                )}
              >
                {v.size}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-smoke">Borde punteado: disponible bajo pedido. Tachado: agotado.</p>
        {error && <p role="alert" className="mt-2 text-sm text-crimson">{error}</p>}
      </fieldset>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => doAdd(false)} disabled={status === "sold_out"} className="btn btn-primary">
          Add to cart
        </button>
        <button type="button" onClick={() => doAdd(true)} disabled={!purchasable} className="btn btn-accent" title={product.isDemo ? "Producto DEMO" : undefined}>
          Buy now
        </button>
        <button type="button" onClick={() => {
            toggleWish({ productId: product.id, slug: product.slug });
            toast(wished ? "Quitado de favoritos" : "Guardado en favoritos", { description: product.name, tone: wished ? "default" : "success" });
          }} aria-pressed={hydrated && wished} className="btn btn-ghost">
          <HeartIcon width={16} filled={hydrated && wished} /> {hydrated && wished ? "En wishlist" : "Add to wishlist"}
        </button>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <WhatsappIcon width={16} /> Ask on WhatsApp
          </a>
        ) : (
          <a href="/contact" className="btn btn-ghost">Contactar</a>
        )}
      </div>
    </div>
  );
}
