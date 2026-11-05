"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const pillars = [
  { word: "ESENCIA", text: "Tres amigos, tres miradas y una misma visión: calzado y ropa auténticos, elegidos con criterio." },
  { word: "ESTILO", text: "Cultura sneaker, moda deportiva y calle. Lo que llevas puesto habla antes que tú." },
  { word: "VISAJE", text: "La actitud con la que pisas. Sin poses, con identidad. Desde Bucaramanga para toda Colombia." },
];

/**
 * ESENCIA · ESTILO · VISAJE. On desktop (and only without reduced motion) the
 * section pins and each word takes the stage in turn while you scroll; on
 * phones and with reduced motion it is a plain stacked list.
 */
export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const words = gsap.utils.toArray<HTMLElement>("[data-word]", el);
      const texts = gsap.utils.toArray<HTMLElement>("[data-text]", el);
      const bar = el.querySelector<HTMLElement>("[data-bar]");
      gsap.set(words, { opacity: 0.08, scale: 0.92 });
      gsap.set(texts, { opacity: 0, y: 24 });
      const tl = gsap.timeline({
        defaults: { ease: "power2.out", duration: 1 },
        scrollTrigger: { trigger: el, start: "top top", end: "+=180%", scrub: 0.6, pin: true, anticipatePin: 1 },
      });
      words.forEach((w, i) => {
        tl.to(w, { opacity: 1, scale: 1 }, i * 1.4).to(texts[i], { opacity: 1, y: 0 }, i * 1.4 + 0.2);
        if (i < words.length - 1) tl.to(w, { opacity: 0.18, scale: 0.96 }, i * 1.4 + 1.2).to(texts[i], { opacity: 0, y: -16 }, i * 1.4 + 1.2);
      });
      if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", duration: tl.duration() }, 0);
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} aria-labelledby="manifesto-title" className="relative overflow-hidden border-t border-line bg-ink lg:h-svh">
      <div aria-hidden className="stripes absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex h-full max-w-[1600px] flex-col justify-center px-4 py-20 md:px-8">
        <h2 id="manifesto-title" className="eyebrow mb-8">Manifiesto TR3S</h2>
        <ol className="grid gap-10 lg:grid-cols-3 lg:gap-6">
          {pillars.map((p, i) => (
            <li key={p.word} className="relative">
              <p className="font-display text-xs tracking-[0.3em] text-crimson">0{i + 1}</p>
              <p data-word className="headline mt-2 origin-left text-[18vw] leading-[0.85] sm:text-8xl xl:text-[9rem]">
                {p.word}
              </p>
              <p data-text className="mt-4 max-w-sm text-base leading-relaxed text-bone/75">
                {p.text}
              </p>
            </li>
          ))}
        </ol>
        <span aria-hidden data-bar className="mt-14 hidden h-px origin-left bg-crimson lg:block" />
      </div>
    </section>
  );
}
