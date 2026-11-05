"use client";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types/domain";
import { AvailabilityBadge, NoPhoto, Price, ProductFlags, QuickAdd } from "@/features/catalog/bits";
import { productAvailability, shortestLeadTime } from "@/services/availability";
import { useWishlist } from "@/features/wishlist/store";
import { toast } from "@/features/ui/toast";
import { HeartIcon } from "@/components/icons";
import { useHydrated } from "@/hooks/useHydrated";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const hydrated = useHydrated();
  const wished = useWishlist((s) => s.items.some((i) => i.productId === product.id));
  const toggle = useWishlist((s) => s.toggle);
  const status = productAvailability(product);
  const img = product.images[0];
  const alt = product.images[1];
  return (
    <article className="group relative flex flex-col border border-line bg-coal transition-colors hover:border-paper/30">
      <div className="absolute left-3 top-3 z-10"><ProductFlags product={product} /></div>
      <button
        type="button"
        onClick={() => {
          toggle({ productId: product.id, slug: product.slug });
          toast(wished ? "Quitado de favoritos" : "Guardado en favoritos", { description: product.name, tone: wished ? "default" : "success" });
        }}
        aria-pressed={hydrated && wished}
        aria-label={wished ? `Quitar ${product.name} de wishlist` : `Guardar ${product.name} en wishlist`}
        className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center text-paper/80 hover:text-crimson"
      >
        <HeartIcon filled={hydrated && wished} />
      </button>
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-graphite/40">
        {!img && <NoPhoto brand={product.brand.name} compact />}
        {img && (
          <Image
            src={img.url}
            alt={img.alt}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-5 transition-all duration-700 group-hover:scale-[1.04] group-hover:opacity-0"
          />
        )}
        {(alt ?? img) && (
          <Image
            src={(alt ?? img)!.url}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-5 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          />
        )}
      </Link>
      <div className="flex flex-1 items-end justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="eyebrow">{product.brand.name}</p>
          <h3 className="truncate font-display text-[15px] font-medium text-paper">
            <Link href={`/product/${product.slug}`}>{product.name}</Link>
          </h3>
          <p className="mt-1 font-display text-sm text-bone/80"><Price price={product.price} compareAt={product.compareAtPrice} /></p>
          <AvailabilityBadge className="mt-2" status={status} leadTimeDays={shortestLeadTime(product)} />
        </div>
        <QuickAdd product={product} />
      </div>
    </article>
  );
}
