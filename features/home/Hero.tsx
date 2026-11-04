"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import type { HeroCampaign, Product } from "@/types/domain";
import { AvailabilityBadge, NoPhoto, Price, ProductFlags, QuickAdd } from "@/features/catalog/bits";
import { productAvailability, shortestLeadTime } from "@/services/availability";
import { ArrowIcon } from "@/components/icons";
import { cn } from "@/lib/format";
import { hasWebGL, isLowPowerDevice } from "@/features/three/webgl";
import { usePrefersReducedMotion } from "@/hooks/useHydrated";

const HeroScene = dynamic(() => import("@/features/three/HeroScene"), { ssr: false });

export function Hero({ campaign, products }: { campaign: HeroCampaign; products: Product[] }) {
  const [index, setIndex] = useState(0);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [gl, setGl] = useState<{ ok: boolean; low: boolean } | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const product = products[index];
  const section = useRef<HTMLElement>(null);
  const scrollRef = useRef(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => (scrollRef.current = v));

  useEffect(() => {
    // Defer 3D until the commercial content has painted.
    const id = requestAnimationFrame(() => setGl({ ok: hasWebGL(), low: isLowPowerDevice() }));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => setSizeIdx(null), [index]);

  const has3D = Boolean(product && (product.modelUrl || product.conceptColorway));
  const stageItem = useMemo(
    () => (product ? { key: product.id, modelUrl: product.modelUrl, colorway: product.conceptColorway } : null),
    [product],
  );
  const word = campaign.monumentalWords[index % Math.max(1, campaign.monumentalWords.length)] ?? "TR3S";

  if (!product) {
    return (
      <section className="grid min-h-[70svh] place-items-center px-4 text-center">
        <div>
          <h2 className="font-display text-5xl font-bold md:text-7xl">{campaign.headline.join(" ")}</h2>
          <p className="mt-4 text-smoke">Pronto publicaremos nuestro catálogo.</p>
        </div>
      </section>
    );
  }

  const status = productAvailability(product);
  const lead = shortestLeadTime(product);
  const selectedVariant = sizeIdx != null ? product.variants[sizeIdx] : null;
  const showCanvas = has3D && gl?.ok;

  return (
    <section ref={section} aria-label="Producto protagonista" className="relative overflow-hidden bg-ink">
      {/* cinematic ambient light */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[38%] h-[70vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-wine/25 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 px-4 pt-6 md:px-8 lg:min-h-[max(460px,calc(100svh-72px-300px))] lg:grid-cols-12 lg:pt-10">
        {/* LEFT: campaign copy */}
        <div className="relative z-10 lg:col-span-3 lg:flex lg:flex-col lg:justify-center">
          <p className="eyebrow mb-4">TR3S &amp; CO. · Multimarca</p>
          <h2 className="font-display text-[13vw] font-bold leading-[0.88] tracking-[-0.04em] text-paper sm:text-6xl xl:text-7xl">
            {campaign.headline.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
          </h2>
          <p className="mt-5 font-editorial text-xl italic text-bone/80 md:text-2xl">{campaign.subheadline}</p>
        </div>

        {/* CENTER: monumental type + stage */}
        <div className="relative h-[46svh] min-h-[300px] lg:col-span-6 lg:h-auto">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={word}
                initial={{ opacity: 0, y: reduced ? 0 : 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -40 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="monumental select-none whitespace-nowrap text-[30vw] lg:text-[17vw]"
                style={{ color: "rgb(255 255 255 / 0.05)" }}
              >
                {word}
              </motion.span>
            </AnimatePresence>
          </div>

          {showCanvas && stageItem ? (
            <div className={cn("absolute inset-0 transition-opacity duration-700", sceneReady ? "opacity-100" : "opacity-0")}>
              <HeroScene item={stageItem} reducedMotion={reduced} lowPower={gl.low} scrollProgress={scrollRef} onReady={() => setSceneReady(true)} />
            </div>
          ) : null}

          {/* Photo stage: real photo when there is no authorized model, or before/without WebGL */}
          {(!showCanvas || !sceneReady) && (
            <AnimatePresence mode="wait">
              <motion.div
                key={product.id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.94, x: reduced ? 0 : 40 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.96, x: reduced ? 0 : -40 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* the TR3S watermark already fills the stage */}
                {!product.images[0] && !has3D && <div className="absolute inset-x-0 bottom-[22%]"><NoPhoto /></div>}
                {product.images[0] && (
                  <Image
                    src={product.images[0].url}
                    alt={product.images[0].alt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain p-6 drop-shadow-[0_40px_40px_rgba(0,0,0,0.6)]"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {showCanvas && (
            <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] text-smoke">
              ARRASTRA PARA GIRAR{product.isDemo || !product.modelUrl ? " · RENDER CONCEPTUAL" : ""}
            </p>
          )}
        </div>

        {/* RIGHT: dynamic product info */}
        <div className="relative z-10 pb-6 lg:col-span-3 lg:flex lg:flex-col lg:justify-center lg:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: reduced ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="border-l border-line pl-5 lg:pl-8"
              aria-live="polite"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="eyebrow">{product.brand.name}</p>
                <ProductFlags product={product} />
              </div>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-paper xl:text-4xl">{product.name}</h2>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-bone/70">{product.description}</p>
              <p className="mt-5 font-display text-2xl text-paper">
                <Price price={selectedVariant?.price ?? product.price} compareAt={product.compareAtPrice} />
              </p>
              <AvailabilityBadge
                className="mt-3"
                status={selectedVariant?.availability.status ?? status}
                leadTimeDays={selectedVariant?.availability.leadTimeDays ?? lead}
              />
              <div className="mt-5">
                <p className="eyebrow mb-2">Talla{selectedVariant ? ` seleccionada: ${selectedVariant.size}` : ""}</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.variants.slice(0, 10).map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.availability.status === "sold_out"}
                      aria-pressed={sizeIdx === i}
                      onClick={() => setSizeIdx(i)}
                      className={cn(
                        "h-9 min-w-10 border px-2 text-xs transition-colors",
                        sizeIdx === i ? "border-paper bg-paper text-ink" : "border-paper/20 text-bone hover:border-paper",
                        v.availability.status === "sold_out" && "border-line text-smoke line-through",
                        v.availability.status === "available_on_order" && sizeIdx !== i && "border-dashed",
                      )}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                <Link href={`/product/${product.slug}${selectedVariant ? `?size=${selectedVariant.size}` : ""}`} className="btn btn-primary flex-1">
                  View product
                </Link>
                <Link href={`/shop?category=${product.category.slug}`} className="btn btn-ghost flex-1">
                  Shop now
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <HeroCarousel products={products} index={index} onSelect={setIndex} />
    </section>
  );
}

function HeroCarousel({ products, index, onSelect }: { products: Product[]; index: number; onSelect: (i: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const select = (i: number) => {
    onSelect(i);
    const el = track.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };
  return (
    <div className="relative border-t border-line">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 pb-3 pt-4 md:px-8">
        <h2 className="eyebrow">Featured · {String(index + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => select((index - 1 + products.length) % products.length)} className="grid h-10 w-10 place-items-center border border-line hover:border-paper" aria-label="Producto anterior">
            <ArrowIcon dir="left" width={16} />
          </button>
          <button type="button" onClick={() => select((index + 1) % products.length)} className="grid h-10 w-10 place-items-center border border-line hover:border-paper" aria-label="Producto siguiente">
            <ArrowIcon width={16} />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="no-scrollbar mx-auto flex max-w-[1600px] snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 md:scroll-px-8 md:px-8"
        role="listbox"
        aria-label="Productos destacados"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && track.current) {
            const el = track.current;
            const atEdge = (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
            if (!atEdge) el.scrollLeft += e.deltaY;
          }
        }}
      >
        {products.map((p, i) => {
          const active = i === index;
          return (
            <div
              key={p.id}
              role="option"
              aria-selected={active}
              tabIndex={0}
              onClick={() => select(i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select(i))}
              className={cn(
                "group relative flex w-[78%] shrink-0 snap-start cursor-pointer flex-col border bg-coal p-3.5 transition-all duration-300 [perspective:800px] sm:w-[46%] lg:w-[calc(25%-9px)]",
                active ? "border-paper/60 bg-graphite" : "border-line hover:border-paper/30",
              )}
            >
              <div className="flex items-start justify-between">
                <ProductFlags product={p} />
                <AvailabilityBadge status={productAvailability(p)} />
              </div>
              <div className="relative my-1 h-28 transition-transform duration-500 group-hover:[transform:rotateX(8deg)_rotateY(-10deg)_translateZ(20px)] lg:h-24 xl:h-28">
                {p.images[0] ? <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="(max-width: 640px) 78vw, 25vw" className="object-contain" /> : <NoPhoto brand={p.brand.name} compact />}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{p.brand.name}</p>
                  <p className="truncate font-display text-base font-medium text-paper">{p.name}</p>
                  <p className="mt-1 font-display text-sm text-bone/80">
                    <Price price={p.price} compareAt={p.compareAtPrice} />
                  </p>
                </div>
                <QuickAdd product={p} />
              </div>
              {active && <motion.span layoutId="hero-active" className="absolute inset-x-0 top-0 h-[2px] bg-crimson" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
