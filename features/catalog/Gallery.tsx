"use client";
import { NoPhoto } from "@/features/catalog/bits";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "@/types/domain";
import { cn } from "@/lib/format";
import { hasWebGL, isLowPowerDevice } from "@/features/three/webgl";

const ProductViewer = dynamic(() => import("@/features/three/ProductViewer"), { ssr: false });

/**
 * Product gallery, photography first: large studio photos on a light
 * backdrop, hover magnifier on desktop, swipe on phones, full-screen viewer.
 * The 360° tab only appears for an authorized GLB of this exact product
 * (or the concept render of DEMO data, labelled as such).
 */
export function Gallery({ product }: { product: Product }) {
  const has3D = Boolean(product.modelUrl || (product.isDemo && product.conceptColorway));
  const images = product.images;
  const [mode, setMode] = useState<"photo" | "3d">("photo");
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const [env, setEnv] = useState<{ ok: boolean; low: boolean }>({ ok: false, low: true });
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => setEnv({ ok: hasWebGL(), low: isLowPowerDevice() }), []);
  const img = images[idx];

  const go = useCallback((n: number) => setIdx((i) => (images.length ? (i + n + images.length) % images.length : 0)), [images.length]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [full, go]);

  // phones: swipeable strip keeps idx in sync
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  return (
    <div className="lg:sticky lg:top-24">
      <div className="relative aspect-square overflow-hidden rounded-[4px] bg-studio">
        {mode === "3d" && env.ok ? (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#2a2a2a,#0b0b0b)]">
            <ProductViewer modelUrl={product.modelUrl} colorway={product.isDemo ? product.conceptColorway : null} lowPower={env.low} />
          </div>
        ) : !img ? (
          <div className="absolute inset-0 bg-coal"><NoPhoto brand={product.brand.name} /></div>
        ) : (
          <>
            {/* desktop: crossfade + magnifier */}
            <AnimatePresence mode="wait">
              <motion.button
                type="button"
                key={img.url}
                onClick={() => setFull(true)}
                aria-label="Ver foto en pantalla completa"
                className="absolute inset-0 hidden cursor-zoom-in md:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                }}
                onMouseLeave={() => setZoom(null)}
              >
                <Image
                  src={img.url}
                  alt={img.alt || product.name}
                  fill
                  priority
                  quality={92}
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-contain p-6 transition-transform duration-200 ease-out"
                  style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                />
              </motion.button>
            </AnimatePresence>
            {/* phones: native swipe */}
            <div ref={strip} onScroll={onScroll} className="no-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto md:hidden">
              {images.map((im, i) => (
                <button key={im.url} type="button" onClick={() => { setIdx(i); setFull(true); }} className="relative h-full w-full shrink-0 snap-center" aria-label={`Ampliar foto ${i + 1}`}>
                  <Image src={im.url} alt={im.alt || product.name} fill priority={i === 0} quality={90} sizes="100vw" className="object-contain p-4" />
                </button>
              ))}
            </div>
            {img.alt && <p className="pointer-events-none absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.25em] text-ink/50">{img.alt}</p>}
            {images.length > 1 && (
              <p className="pointer-events-none absolute bottom-3 right-4 font-display text-[11px] tracking-[0.2em] text-ink/50">
                {idx + 1} / {images.length}
              </p>
            )}
          </>
        )}
        {mode === "3d" && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] text-smoke">
            ARRASTRA PARA GIRAR · ZOOM CON SCROLL O PELLIZCO{product.modelUrl ? "" : " · RENDER CONCEPTUAL DEMO"}
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {images.map((im, i) => (
          <button
            key={im.url}
            type="button"
            onClick={() => {
              setMode("photo");
              setIdx(i);
              strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "smooth" });
            }}
            aria-label={im.alt ? `Ver ${im.alt}` : `Ver imagen ${i + 1}`}
            aria-pressed={mode === "photo" && i === idx}
            className={cn("relative h-20 w-20 shrink-0 overflow-hidden rounded-[3px] border-2 bg-studio transition-colors", mode === "photo" && i === idx ? "border-crimson" : "border-transparent hover:border-paper/40")}
          >
            <Image src={im.url} alt="" fill sizes="80px" className="object-contain p-1.5" />
          </button>
        ))}
        {has3D && env.ok && (
          <button
            type="button"
            onClick={() => setMode("3d")}
            aria-pressed={mode === "3d"}
            className={cn("grid h-20 w-20 shrink-0 place-items-center rounded-[3px] border-2 font-display text-sm font-semibold", mode === "3d" ? "border-crimson text-crimson" : "border-line")}
          >
            360°
          </button>
        )}
      </div>

      <AnimatePresence>
        {full && img && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Fotos de ${product.name}`}
            className="fixed inset-0 z-[100] flex flex-col bg-studio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-3 text-ink">
              <p className="font-display text-sm tracking-[0.15em]">{product.brand.name} · {product.name}</p>
              <button type="button" onClick={() => setFull(false)} className="grid h-11 w-11 place-items-center text-2xl" aria-label="Cerrar">×</button>
            </div>
            <div className="relative flex-1">
              <Image src={img.url} alt={img.alt || product.name} fill quality={95} sizes="100vw" className="object-contain p-4 md:p-10" />
              {images.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-ink/80 text-paper">‹</button>
                  <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-ink/80 text-paper">›</button>
                </>
              )}
            </div>
            <p className="py-3 text-center text-[11px] uppercase tracking-[0.25em] text-ink/60">{img.alt || " "} {images.length > 1 && `· ${idx + 1} / ${images.length}`}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
