"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

const pillars = [
  { word: "ESENCIA", text: "Tres fundadores, tres miradas y una misma visión: calzado auténtico elegido con criterio." },
  { word: "ESTILO", text: "Sneakers, running, casual y formal. Hombre y mujer. Marcas que conoces, curaduría que nos define." },
  { word: "VISAJE", text: "La actitud con la que pisas. Lo que llevas puesto dice quién eres antes de que hables." },
];

/** Scroll-linked editorial sequence. Native scroll is never hijacked. */
export function Storytelling() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["10%", "-35%"]);

  return (
    <section ref={ref} aria-labelledby="story-title" className="relative overflow-hidden border-t border-line bg-ink py-24 md:py-32">
      <motion.p aria-hidden style={{ x }} className="monumental pointer-events-none whitespace-nowrap text-[22vw] leading-none" >
        TRES ALMAS UNA ESENCIA
      </motion.p>
      <div className="mx-auto -mt-[8vw] max-w-[1600px] px-4 md:px-8">
        <h2 id="story-title" className="sr-only">Tres almas, una esencia</h2>
        <div className="grid gap-10 md:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.word}
              initial={reduced ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-paper/20 pt-6"
            >
              <p className="font-display text-xs tracking-[0.3em] text-crimson">0{i + 1}</p>
              <h3 className="mt-3 font-display text-4xl font-bold tracking-tight">{p.word}</h3>
              <p className="mt-4 max-w-sm font-editorial text-xl italic leading-snug text-bone/75">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
