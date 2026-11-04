import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td, Pill, Flash, Stat } from "@/features/admin/ui";
import { formatCOP } from "@/lib/format";
import { paymentMethodLabel, paymentStatusLabel, paymentTone } from "@/features/account/status";
import { providers } from "@/services/payments/providers";

const dt = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["sales"]);
  let pq = staff.sb.from("payments").select("id, provider, transaction_id, status, amount, created_at, updated_at, order:orders(id, number, total)").order("created_at", { ascending: false }).limit(200);
  if (sp.provider) pq = pq.eq("provider", sp.provider);
  if (sp.status) pq = pq.eq("status", sp.status);
  let eq = staff.sb.from("webhook_events").select("id, provider, event_key, status, error, order_number, received_at").order("received_at", { ascending: false }).limit(100);
  if (sp.events === "problems") eq = eq.in("status", ["rejected", "error"]);
  const [{ data: payments }, { data: events }] = await Promise.all([pq, eq]);
  const totals = (payments ?? []).reduce(
    (acc, p) => {
      if (p.status === "approved") acc.approved += p.amount;
      acc[p.status === "approved" ? "ok" : p.status === "pending" ? "pending" : "bad"]++;
      return acc;
    },
    { approved: 0, ok: 0, pending: 0, bad: 0 },
  );
  const filter = (k: string, v: string, label: string) => {
    const active = sp[k] === v || (!sp[k] && !v);
    const next = new URLSearchParams(Object.entries(sp).filter(([kk, vv]) => kk !== k && kk !== "ok" && kk !== "error" && vv) as [string, string][]);
    if (v) next.set(k, v);
    return (
      <Link key={k + v} href={`/admin/payments${next.size ? `?${next}` : ""}`} className={`border px-3 py-1.5 text-xs ${active ? "border-paper text-paper" : "border-line text-smoke hover:text-paper"}`}>
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="Pagos" eyebrow="Transacciones y eventos" />
      <Flash sp={sp} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aprobado (listado)" value={formatCOP(totals.approved)} hint={`${totals.ok} transacciones`} />
        <Stat label="Pendientes" value={totals.pending} tone={totals.pending ? "warn" : undefined} />
        <Stat label="Rechazados / anulados" value={totals.bad} tone={totals.bad ? "bad" : undefined} />
        <Stat
          label="Pasarelas activas"
          value={Object.values(providers).filter((p) => p.id !== "transfer" && p.implemented && p.configured()).map((p) => p.label).join(" · ") || "Ninguna"}
          hint="Credenciales en Vercel · switches en Configuración"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {filter("provider", "", "Todos")}
        {filter("provider", "wompi", "Wompi")}
        {filter("provider", "mercadopago", "Mercado Pago")}
        {filter("provider", "transfer", "Transferencia")}
        <span className="mx-2 w-px bg-line" />
        {filter("status", "", "Cualquier estado")}
        {filter("status", "approved", "Aprobados")}
        {filter("status", "pending", "Pendientes")}
        {filter("status", "declined", "Rechazados")}
        {filter("status", "voided", "Anulados")}
      </div>
      <Table head={["Fecha", "Pedido", "Proveedor", "Referencia / transacción", "Estado", "Monto"]} empty={!payments?.length}>
        {payments?.map((p) => {
          const o = (Array.isArray(p.order) ? p.order[0] : p.order) as { id: string; number: string; total: number } | null;
          return (
            <tr key={p.id}>
              <Td className="whitespace-nowrap text-xs">{dt(p.created_at)}</Td>
              <Td>{o ? <Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link> : "—"}</Td>
              <Td>{paymentMethodLabel[p.provider] ?? p.provider}</Td>
              <Td className="max-w-[16rem] break-all text-xs">{p.transaction_id}</Td>
              <Td><Pill tone={paymentTone(p.status)}>{paymentStatusLabel[p.status] ?? p.status}</Pill></Td>
              <Td>
                {formatCOP(p.amount)}
                {o && p.status === "approved" && p.amount !== o.total && <span className="block text-xs text-crimson">≠ total {formatCOP(o.total)}</span>}
              </Td>
            </tr>
          );
        })}
      </Table>

      <section className="mt-12">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Eventos de pago (webhooks)</h2>
            <p className="text-sm text-smoke">Cada notificación de Wompi o Mercado Pago: procesada, ignorada, rechazada por firma inválida o con error.</p>
          </div>
          <div className="flex gap-2">
            {filter("events", "", "Todos")}
            {filter("events", "problems", "Solo problemas")}
          </div>
        </div>
        <Table head={["Recibido", "Proveedor", "Evento", "Pedido", "Resultado", "Detalle"]} empty={!events?.length}>
          {events?.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap text-xs">{dt(e.received_at)}</Td>
              <Td>{paymentMethodLabel[e.provider] ?? e.provider}</Td>
              <Td className="max-w-[14rem] break-all text-xs">{e.event_key}</Td>
              <Td className="text-xs">{e.order_number ?? "—"}</Td>
              <Td>
                <Pill tone={e.status === "processed" ? "ok" : e.status === "ignored" || e.status === "received" ? "muted" : "bad"}>
                  {{ processed: "Procesado", ignored: "Ignorado", rejected: "Rechazado", error: "Error", received: "Recibido" }[e.status as string] ?? e.status}
                </Pill>
              </Td>
              <Td className="max-w-[18rem] text-xs text-smoke">{e.error ?? ""}</Td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
