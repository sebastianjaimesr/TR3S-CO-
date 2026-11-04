"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Product } from "@/types/domain";
import { cn } from "@/lib/format";
import { hasWebGL, isLowPowerDevice } from "@/features/three/webgl";

const ProductViewer = dynamic(() => import("@/features/three/ProductViewer"), { ssr: false });

export function Gallery({ product }: { product: Product }) {
  const has3D = Boolean(product.modelUrl || product.conceptColorway);
  const [mode, setMode] = useState<"photo" | "3d">("photo");
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [env, setEnv] = useState<{ ok: boolean; low: boolean }>({ ok: false, low: true });
  useEffect(() => setEnv({ ok: hasWebGL(), low: isLowPowerDevice() }), []);
  const img = product.images[idx];

  return (
    <div className="lg:sticky lg:top-24">
      <div className="relative aspect-square overflow-hidden border border-line bg-coal">
        {mode === "3d" && env.ok ? (
          <ProductViewer modelUrl={product.modelUrl} colorway={product.conceptColorway} lowPower={env.low} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={img?.url ?? "none"}
              className="absolute inset-0 cursor-zoom-in"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
              onMouseLeave={() => setZoom(null)}
            >
              {img && (
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-contain p-8 transition-transform duration-200"
                  style={zoom ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
        {mode === "3d" && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.25em] text-smoke">
            ARRASTRA PARA GIRAR · ZOOM CON SCROLL O PELLIZCO{product.modelUrl ? "" : " · RENDER CONCEPTUAL"}
          </p>
        )}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {product.images.map((im, i) => (
          <button
            key={im.url}
            type="button"
            onClick={() => {
              setMode("photo");
              setIdx(i);
            }}
            aria-label={`Ver imagen ${i + 1}`}
            aria-pressed={mode === "photo" && i === idx}
            className={cn("relative h-20 w-20 shrink-0 border bg-coal", mode === "photo" && i === idx ? "border-paper" : "border-line")}
          >
            <Image src={im.url} alt="" fill sizes="80px" className="object-contain p-2" />
          </button>
        ))}
        {has3D && env.ok && (
          <button
            type="button"
            onClick={() => setMode("3d")}
            aria-pressed={mode === "3d"}
            className={cn("grid h-20 w-20 shrink-0 place-items-center border font-display text-sm font-semibold", mode === "3d" ? "border-crimson text-crimson" : "border-line")}
          >
            360°
          </button>
        )}
      </div>
    </div>
  );
}
