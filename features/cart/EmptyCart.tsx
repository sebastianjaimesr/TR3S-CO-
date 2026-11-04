import Link from "next/link";
import { BagIcon } from "@/components/icons";
import { cn } from "@/lib/format";

/** Empty bag state shared by the drawer, /cart and /checkout. */
export function EmptyCart({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center overflow-hidden text-center", compact ? "flex-1 px-8 py-12" : "border border-line px-6 py-20")}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none font-display text-[28vw] font-bold leading-none tracking-tighter text-paper/[0.03] sm:text-[14rem]">
        TR3S
      </span>
      <span className="relative grid h-16 w-16 place-items-center rounded-full border border-line text-crimson">
        <BagIcon width={26} height={26} />
      </span>
      <p className="relative mt-6 font-display text-2xl font-bold tracking-tight md:text-3xl">TU PRÓXIMO ESTILO COMIENZA AQUÍ</p>
      <p className="relative mt-3 max-w-sm text-sm text-smoke">Tu carrito está vacío. Explora la tienda y guarda lo que te mueva.</p>
      <div className="relative mt-8 flex flex-wrap justify-center gap-2">
        <Link href="/shop" onClick={onNavigate} className="btn btn-primary">Explorar la tienda</Link>
        <Link href="/new-arrivals" onClick={onNavigate} className="btn btn-ghost">New arrivals</Link>
      </div>
    </div>
  );
}
