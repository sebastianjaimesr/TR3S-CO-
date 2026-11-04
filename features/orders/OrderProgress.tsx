import { cn } from "@/lib/format";
import { progressIndex, progressSteps } from "@/features/account/status";

/** Visual 5-step timeline. Only shows milestones the order really reached. */
export function OrderProgress({ status, paymentStatus, shipmentStatus }: { status: string; paymentStatus?: string | null; shipmentStatus?: string | null }) {
  const cancelled = status === "cancelled";
  const current = progressIndex({ status, payment_status: paymentStatus, shipment_status: shipmentStatus });
  return (
    <div className="mt-8">
      <ol className="grid grid-cols-5 gap-1" aria-label="Progreso del pedido">
        {progressSteps.map((label, i) => {
          const done = !cancelled && i <= current;
          return (
            <li key={label} className="min-w-0" aria-current={i === current && !cancelled ? "step" : undefined}>
              <span className={cn("block h-1 w-full transition-colors duration-700", done ? "bg-crimson" : "bg-graphite")} />
              <span className={cn("mt-2 flex items-start gap-1.5 text-[10px] leading-tight tracking-[0.08em] sm:text-[11px]", done ? "text-paper" : "text-smoke")}>
                <span className={cn("mt-[3px] hidden h-1.5 w-1.5 shrink-0 rounded-full sm:inline-block", done ? "bg-crimson" : "bg-graphite")} aria-hidden />
                <span className="uppercase">{label}</span>
              </span>
              <span className="sr-only">{done ? "completado" : "pendiente"}</span>
            </li>
          );
        })}
      </ol>
      {cancelled && <p className="mt-3 text-sm text-crimson">Este pedido fue cancelado.</p>}
      {shipmentStatus === "delivery_issue" && <p className="mt-3 text-sm text-amber-300">Hay una novedad con la entrega. Te contactaremos para resolverla.</p>}
    </div>
  );
}
