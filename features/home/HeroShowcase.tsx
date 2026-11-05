"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import type { Product } from "@/types/domain";
import { Price } from "@/features/catalog/bits";
import { ArrowIcon } from "@/components/icons";
import { usePrefersReducedMotion } from "@/hooks/useHydrated";

/**
 * Hero spotlight for a REAL catalog product: its own studio photo, large and
 * sharp, floating subtly with a small pointer tilt. Realism first: no 3D
 * reconstruction, no filters on the photo.
 */
export function HeroShowcase({ product }: { product: Product }) {
  const card = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const img = product.images[0];
  if (!img) return null;

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !card.current) return;
    const r = card.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.current.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    card.current.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
  };
  const onLeave = () => {
    card.current?.style.setProperty("--rx", "0deg");
    card.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <Link href={`/product/${product.slug}`} className="group relative mx-auto block w-full max-w-[640px]" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="[perspective:1200px]">
        <div ref={card} className="hero-tilt relative">
          <div className="hero-float relative aspect-[4/3] overflow-hidden rounded-[6px] bg-studio shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]">
            <Image
              src={img.url}
              alt={img.alt || `${product.brand.name} ${product.name}`}
              fill
              priority
              quality={92}
              sizes="(max-width: 1024px) 92vw, 640px"
              className="object-contain p-6 transition-transform duration-700 ease-out group-hover:scale-[1.03] md:p-10"
            />
          </div>
          {/* soft floor shadow that breathes with the float */}
          <div aria-hidden className="hero-shadow mx-auto mt-5 h-5 w-3/4 rounded-[50%] bg-black/70 blur-xl" />
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{product.brand.name}</p>
          <p className="truncate font-display text-lg text-paper">{product.name}</p>
          <p className="font-display text-sm text-bone/80"><Price price={product.price} compareAt={product.compareAtPrice} /></p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs tracking-[0.2em] text-paper/80 group-hover:text-paper">
          VER PRODUCTO <ArrowIcon className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
