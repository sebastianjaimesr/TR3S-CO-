"use client";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Soft page transition: a template re-mounts on every navigation inside the store.
 * Opacity only: a transform here would break position:fixed/sticky and GSAP pins below it.
 */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
