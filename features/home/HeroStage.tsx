"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ConceptColorway } from "@/types/domain";
import { hasWebGL, isLowPowerDevice } from "@/features/three/webgl";
import { usePrefersReducedMotion } from "@/hooks/useHydrated";
import { cn } from "@/lib/format";

const ConceptHeroScene = dynamic(() => import("@/features/three/ConceptHeroScene"), { ssr: false });

/** Three colourways of the TR3S CONCEPT: three friends, three personalities. Not products. */
export const conceptColorways: { id: string; label: string; swatch: string; colorway: ConceptColorway }[] = [
  { id: "esencia", label: "Esencia", swatch: "#0b0b0b", colorway: { upper: "#0d0d0d", accent: "#d50025", midsole: "#f1f1f1", sole: "#141414", laces: "#f5f5f5" } },
  { id: "estilo", label: "Estilo", swatch: "#f1f1f1", colorway: { upper: "#ededed", accent: "#d50025", midsole: "#ffffff", sole: "#8a6a4a", laces: "#ffffff" } },
  { id: "visaje", label: "Visaje", swatch: "#8d929a", colorway: { upper: "#7f848c", accent: "#d50025", midsole: "#151515", sole: "#0a0a0a", laces: "#101010" } },
];

/**
 * Client island of the home hero: mounts the 3D stage once the text has
 * painted, wires GSAP ScrollTrigger to the hero and falls back to the static
 * brand composition (passed as children) when WebGL is not available.
 */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const reduced = usePrefersReducedMotion();
  const [gl, setGl] = useState<{ ok: boolean; low: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Wait for idle time so the headline (LCP) is never blocked by three.js.
    const start = () => setGl({ ok: hasWebGL(), low: isLowPowerDevice() });
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(start, 300);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const section = root.current?.closest("section");
    if (!section) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => (progress.current = self.progress),
      });
      if (reduced) return;
      // Text layers leave at different speeds: depth without hijacking scroll.
      gsap.utils.toArray<HTMLElement>("[data-depth]", section).forEach((el) => {
        const depth = Number(el.dataset.depth ?? 1);
        gsap.to(el, { yPercent: -18 * depth, opacity: depth > 1.5 ? 0 : 0.25, ease: "none", scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true } });
      });
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  const show3D = gl?.ok === true;
  const current = conceptColorways[active];

  return (
    <div ref={root} className="relative mx-auto aspect-square w-full max-w-[min(92vw,640px)] lg:max-w-none">
      {/* Static brand composition: shown first, kept when there is no WebGL */}
      <div className={cn("absolute inset-0 transition-opacity duration-700", show3D && ready ? "opacity-0" : "opacity-100")} aria-hidden={show3D && ready}>
        {children}
      </div>
      {show3D && (
        <>
          <div className={cn("absolute inset-0 cursor-grab transition-opacity duration-1000 active:cursor-grabbing", ready ? "opacity-100" : "opacity-0")}>
            <ConceptHeroScene colorway={current.colorway} reducedMotion={reduced} lowPower={gl.low} progress={progress} onReady={() => setReady(true)} />
          </div>
          <div className={cn("absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
            <div className="text-[10px] leading-relaxed tracking-[0.25em] text-smoke">
              <p className="text-paper">TR3S CONCEPT 001</p>
              <p>Diseño 3D original · No es un producto a la venta</p>
              <p className="hidden sm:block">Arrastra para girar</p>
            </div>
            <div role="radiogroup" aria-label="Color del concepto 3D" className="flex items-center gap-2">
              {conceptColorways.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={i === active}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => setActive(i)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border transition-all duration-300",
                    i === active ? "scale-110 border-crimson" : "border-paper/25 hover:border-paper/60",
                  )}
                >
                  <span className="h-5 w-5 rounded-full border border-paper/20" style={{ background: c.swatch }} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
