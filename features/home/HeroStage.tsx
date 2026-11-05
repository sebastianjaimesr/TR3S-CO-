"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowIcon } from "@/components/icons";
import type { HeroStageSlot } from "@/lib/home-media";

export interface StageShoe {
  slot: HeroStageSlot;
  url: string;
  alt: string;
  href: string;
}

/**
 * Placement of each podium inside the stage (percent of the stage box).
 * The center shoe is larger and lower in frame (closer to the camera); the two
 * sides sit higher and smaller (further back). `d` is the parallax depth.
 */
const LAYOUT: Record<HeroStageSlot, { x: number; w: number; floor: number; body: number; d: number; z: number; delay: string }> = {
  "hero-izquierda": { x: 20, w: 34, floor: 22, body: 46, d: 0.55, z: 2, delay: "-1.8s" },
  "hero-derecha": { x: 80, w: 34, floor: 22, body: 46, d: 0.55, z: 2, delay: "-3.6s" },
  "hero-centro": { x: 50, w: 52, floor: 3, body: 30, d: 1, z: 4, delay: "0s" },
};

/** Floor ring around the pedestal top, split in a back and a front half so it wraps the stone. */
function Ring({ half }: { half: "back" | "front" }) {
  const d = half === "back" ? "M4,25 A96,20 0 0 1 196,25" : "M4,25 A96,20 0 0 0 196,25";
  return (
    <svg data-e="ring" viewBox="0 0 200 50" aria-hidden className={`stage-ring ${half === "back" ? "z-0" : "z-30"}`}>
      <path d={d} className="stage-ring-glow" />
      <path d={d} className="stage-ring-core" />
    </svg>
  );
}

function Podium({ shoe, index, active, setActive, priority }: { shoe: StageShoe; index: number; active: number | null; setActive: (i: number | null) => void; priority: boolean }) {
  const l = LAYOUT[shoe.slot];
  const center = shoe.slot === "hero-centro";
  const state = active === null ? undefined : active === index ? "on" : "off";
  return (
    <div
      className="stage-podium"
      data-state={state}
      style={{ left: `${l.x - l.w / 2}%`, width: `${l.w}%`, bottom: `${l.floor}%`, zIndex: l.z, ["--d" as string]: l.d }}
    >
      {/* Shoe */}
      <Link
        href={shoe.href}
        aria-label={`Ver ${shoe.alt}`}
        onPointerEnter={(e) => e.pointerType === "mouse" && setActive(index)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(index)}
        onBlur={() => setActive(null)}
        className="stage-shoe relative z-20 block aspect-[4/3] w-full outline-none"
      >
        <span data-e="shoe" className="absolute inset-0 block">
          <span className="stage-float absolute inset-0 block" style={{ animationDelay: l.delay }}>
            <Image
              src={shoe.url}
              alt={shoe.alt}
              fill
              priority={priority}
              quality={92}
              sizes={center ? "(min-width: 1024px) 34vw, 60vw" : "(min-width: 1024px) 24vw, 44vw"}
              className="stage-photo object-contain object-bottom"
            />
          </span>
          {/* Mirror reflection on the polished stone */}
          <span aria-hidden className="stage-mirror absolute inset-x-0 top-full block h-[14%] overflow-hidden">
            <span className="stage-mirror-float absolute inset-x-0 top-0 block h-[714%]" style={{ animationDelay: l.delay }}>
              <Image src={shoe.url} alt="" fill sizes={center ? "34vw" : "24vw"} quality={60} className="-scale-y-100 object-contain object-bottom" />
            </span>
          </span>
        </span>
        <span className="stage-caption pointer-events-none absolute inset-x-0 -top-2 flex -translate-y-full items-center justify-center">
          <span className="flex items-center gap-2 border border-line bg-ink/80 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-paper backdrop-blur">
            {shoe.alt} <ArrowIcon className="h-3 w-3" />
          </span>
        </span>
      </Link>

      {/* Pedestal: polished black stone with a red floor ring */}
      <div data-e="pedestal" aria-hidden className="relative mx-auto -mt-[9%] w-[76%]">
        <Ring half="back" />
        <div className="stage-contact" />
        <div className="stage-top relative z-10" />
        <div className="stage-body relative" style={{ paddingTop: `${l.body}%` }} />
        <div className="stage-body-mirror" style={{ paddingTop: `${l.body * 0.6}%` }} />
        <Ring half="front" />
      </div>
    </div>
  );
}

/**
 * Cinematic hero stage for the three protagonist sneakers. Every shoe is the
 * owner's own cut-out photo (uploaded in /admin/home): the stage adds
 * pedestals, light rings, haze, reflections and shadows around it, but never
 * redraws, warps or replaces the product.
 */
export function HeroStage({ shoes }: { shoes: StageShoe[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  // Sides first in the DOM so the entrance reveals them before the protagonist.
  const ordered = [...shoes].sort((a, b) => Number(a.slot === "hero-centro") - Number(b.slot === "hero-centro"));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const q = gsap.utils.selector(el);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.classList.remove("stage-wait");
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(q("[data-e=haze]"), { opacity: 0, duration: 2.2 }, 0)
        .from(q("[data-e=halo]"), { scale: 0.7, opacity: 0, duration: 1.6 }, 0.1)
        .from(q("[data-e=pedestal]"), { y: 90, opacity: 0, duration: 1.2, stagger: 0.12 }, 0.15)
        .from(q("[data-e=ring]"), { scaleX: 0.3, opacity: 0, duration: 1.1, stagger: 0.06, transformOrigin: "50% 50%" }, 0.5)
        .from(q("[data-e=shoe]"), { y: 70, opacity: 0, duration: 1.3, stagger: 0.22 }, 0.7);

      // Mouse parallax and a light that follows the pointer (desktop only).
      const proxy = { x: 0, y: 0 };
      const apply = () => {
        el.style.setProperty("--px", proxy.x.toFixed(3));
        el.style.setProperty("--py", proxy.y.toFixed(3));
      };
      const toX = gsap.quickTo(proxy, "x", { duration: 0.9, ease: "power3.out", onUpdate: apply });
      const toY = gsap.quickTo(proxy, "y", { duration: 0.9, ease: "power3.out", onUpdate: apply });
      const section = el.closest("section") ?? el;
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        toX(((e.clientX - r.left) / r.width - 0.5) * 2);
        toY(((e.clientY - r.top) / r.height - 0.5) * 2);
        el.style.setProperty("--lx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty("--ly", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      };
      const onLeave = () => {
        toX(0);
        toY(0);
      };
      section.addEventListener("pointermove", onMove as EventListener);
      section.addEventListener("pointerleave", onLeave);

      // Leaving the hero: the stage sinks and dims slightly (scrubbed, desktop only).
      gsap.matchMedia().add("(min-width: 1024px)", () => {
        gsap.to(q("[data-e=scroll]"), {
          yPercent: 10,
          scale: 0.96,
          opacity: 0.45,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 0.5 },
        });
      });

      return () => {
        section.removeEventListener("pointermove", onMove as EventListener);
        section.removeEventListener("pointerleave", onLeave);
      };
    }, el);
    return () => ctx.revert();
  }, []);

  const center = shoes.find((s) => s.slot === "hero-centro");

  return (
    <div ref={root} className="hero-stage stage-wait relative mx-auto w-full max-w-[1000px]">
      <div data-e="scroll" className="relative aspect-[5/4] w-full sm:aspect-[16/11]">
        {/* Light cone from above and a soft light that follows the pointer */}
        <div aria-hidden data-e="haze" className="stage-cone" />
        <div aria-hidden className="stage-spot" />

        {/* Neon halo behind the protagonist */}
        {center && (
          <div aria-hidden className="stage-layer absolute left-1/2 top-[6%] w-[54%] -translate-x-1/2" style={{ ["--d" as string]: 0.35 }}>
            <svg data-e="halo" viewBox="0 0 200 200" className="w-full overflow-visible">
              <circle cx="100" cy="100" r="92" className="stage-halo-glow" />
              <circle cx="100" cy="100" r="92" className="stage-halo-core" />
              <circle cx="100" cy="100" r="80" className="stage-halo-dash" />
            </svg>
          </div>
        )}

        {/* Glossy floor */}
        <div aria-hidden className="stage-floor" />

        {/* Haze behind the products */}
        <div aria-hidden data-e="haze" className="stage-layer absolute inset-0" style={{ ["--d" as string]: 0.25 }}>
          <span className="stage-smoke left-[-10%] top-[30%] h-[45%] w-[70%]" />
          <span className="stage-smoke stage-smoke-b right-[-12%] top-[22%] hidden h-[50%] w-[65%] sm:block" />
        </div>

        {ordered.map((shoe) => (
          <div key={shoe.slot} className="stage-layer absolute inset-0" style={{ ["--d" as string]: LAYOUT[shoe.slot].d, zIndex: LAYOUT[shoe.slot].z }}>
            <Podium shoe={shoe} index={shoes.indexOf(shoe)} active={active} setActive={setActive} priority={shoe.slot === "hero-centro"} />
          </div>
        ))}

        {/* Low haze in front of the pedestals */}
        <div aria-hidden data-e="haze" className="stage-layer pointer-events-none absolute inset-0 z-10" style={{ ["--d" as string]: 1.5 }}>
          <span className="stage-smoke stage-smoke-red bottom-[-6%] left-[5%] h-[30%] w-[90%]" />
        </div>
      </div>
    </div>
  );
}
