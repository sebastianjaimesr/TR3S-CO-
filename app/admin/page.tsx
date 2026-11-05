import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Stat, Table, Td, Pill, Notice } from "@/features/admin/ui";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, paymentStatusLabel, paymentTone } from "@/features/account/status";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const staff = await requireStaff();
  const [{ data: s, error }, { data: recent }] = await Promise.all([
    staff.sb.rpc("admin_dashboard_stats"),
    staff.sb.from("orders").select("id, number, status, payment_status, total, created_at, first_name, last_name").order("created_at", { ascending: false }).limit(8),
  ]);
  const st = (s ?? {}) as Record<string, number> & { top_products?: { name: string; brand: string; units: number; revenue: number }[] };
  return (
    <>
      <PageHeader
        title="Dashboard"
        eyebrow="TR3S & CO."
        actions={
          <>
            <Link href="/admin/orders?status=pending_payment" className="btn btn-ghost h-10 min-h-0">Pendientes de pago</Link>
            <Link href="/admin/shipping" className="btn btn-ghost h-10 min-h-0">Envíos</Link>
            <Link href="/admin/payments?events=problems" className="btn btn-ghost h-10 min-h-0">Eventos de pago</Link>
          </>
        }
      />
      {denied && <Notice kind="error">Tu rol no tiene acceso a esa sección.</Notice>}
      {error && <Notice kind="error">No se pudieron cargar las métricas: {error.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas hoy" value={formatCOP(st.sales_today ?? 0)} hint={`${st.orders_today ?? 0} pedidos pagados`} />
        <Stat label="Ventas del mes" value={formatCOP(st.sales_month ?? 0)} />
        <Stat label="Ingresos acumulados" value={formatCOP(st.revenue_total ?? 0)} />
        <Stat label="Margen estimado (mes)" value={formatCOP(st.margin_month ?? 0)} hint={st.lines_without_cost ? `${st.lines_without_cost} líneas sin costo registrado` : "Precio − costo registrado"} />
        <Stat label="Pedidos pendientes" value={st.pending_orders ?? 0} tone={(st.pending_orders ?? 0) > 0 ? "warn" : undefined} hint={`${st.awaiting_supplier ?? 0} esperan proveedor · ${st.incidents ?? 0} incidencias`} />
        <Stat label="Pedidos completados" value={st.completed_orders ?? 0} />
        <Stat label="Pagos confirmados" value={st.payments_approved ?? 0} hint={`${st.paid_orders ?? 0} pedidos pagados · ticket promedio ${formatCOP(st.average_ticket ?? 0)}`} />
        <Stat label="Esperando pago" value={st.awaiting_payment ?? 0} hint={`${st.payments_failed ?? 0} pagos rechazados/anulados`} />
        <Stat label="Por despachar" value={st.to_dispatch ?? 0} tone={(st.to_dispatch ?? 0) > 0 ? "warn" : undefined} hint={`${st.delivery_issues ?? 0} novedades de entrega`} />
        <Stat label="Envíos por cotizar" value={st.pending_quotes ?? 0} tone={(st.pending_quotes ?? 0) > 0 ? "warn" : undefined} hint="No se cobra hasta que el cliente acepte" />
        {(st.webhook_errors ?? 0) > 0 && <Stat label="Eventos de pago con problema (7 días)" value={st.webhook_errors} tone="bad" hint="Revisa Pagos → eventos" />}
        <Stat label="Productos activos" value={st.active_products ?? 0} />
        <Stat label="Stock bajo" value={st.low_stock ?? 0} tone={(st.low_stock ?? 0) > 0 ? "warn" : undefined} hint="Variantes con pocas unidades propias" />
        <Stat label="Variantes agotadas" value={st.sold_out_variants ?? 0} tone={(st.sold_out_variants ?? 0) > 0 ? "bad" : undefined} />
        <Stat label="Inventario propio" value={`${st.own_units ?? 0} pares`} hint={`Valor a costo ${formatCOP(st.own_stock_value ?? 0)}`} />
        <Stat label="Variantes bajo pedido" value={st.on_order_variants ?? 0} hint="Con confirmación vigente del proveedor" />
      </div>
      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Pedidos recientes</h2>
          <Table head={["Pedido", "Cliente", "Pago", "Estado", "Total"]} empty={!recent?.length}>
            {recent?.map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link><br /><span className="text-xs text-smoke">{formatDate(o.created_at)}</span></Td>
                <Td>{o.first_name} {o.last_name}</Td>
                <Td><Pill tone={paymentTone(o.payment_status)}>{paymentStatusLabel[o.payment_status] ?? o.payment_status}</Pill></Td>
                <Td><Pill tone={o.status === "incident" ? "bad" : o.status === "delivered" ? "ok" : "warn"}>{orderStatusLabel[o.status] ?? o.status}</Pill></Td>
                <Td>{formatCOP(o.total)}</Td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Más vendidos</h2>
          <Table head={["Producto", "Unidades", "Ventas"]} empty={!st.top_products?.length}>
            {st.top_products?.map((p) => (
              <tr key={p.name + p.brand}><Td>{p.brand} {p.name}</Td><Td>{p.units}</Td><Td>{formatCOP(p.revenue)}</Td></tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}
