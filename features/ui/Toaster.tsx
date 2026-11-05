"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToasts } from "@/features/ui/toast";
import { cn } from "@/lib/format";

/** Elegant, non-blocking notifications. Announced to screen readers via a polite live region. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const reduced = useReducedMotion();
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduced}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto relative w-full max-w-sm overflow-hidden border bg-coal/95 py-3 pl-4 pr-10 shadow-2xl backdrop-blur",
              t.tone === "error" ? "border-crimson" : "border-line",
            )}
          >
            <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", t.tone === "success" ? "bg-crimson" : t.tone === "error" ? "bg-crimson" : "bg-metal")} />
            <p className="font-display text-sm font-semibold tracking-[0.08em] text-paper">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-bone/70">{t.description}</p>}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación" className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-smoke hover:text-paper">
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
