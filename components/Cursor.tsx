"use client";
import { useEffect, useRef } from "react";

/**
 * Desktop-only cursor accent: a ring that trails the native pointer and grows
 * over interactive elements. The native cursor is never hidden, so text
 * selection, focus and assistive tech are unaffected. Off on touch devices and
 * with prefers-reduced-motion.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!fine.matches || !ring.current) return;
    const el = ring.current;
    let x = -100, y = -100, cx = x, cy = y, raf = 0, hover = false, visible = false;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as Element | null;
      hover = Boolean(t?.closest("a, button, [role='button'], [role='radio'], label, select, summary"));
      if (!visible) {
        visible = true;
        cx = x;
        cy = y;
        el.style.opacity = "1";
      }
    };
    const leave = () => {
      visible = false;
      el.style.opacity = "0";
    };
    const tick = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${hover ? 1.8 : 1})`;
      el.dataset.hover = hover ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <div ref={ring} aria-hidden className="tr3s-cursor" />;
}
