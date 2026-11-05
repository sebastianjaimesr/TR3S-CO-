import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td, Pill, Flash } from "@/features/admin/ui";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, orderTone, paymentMethodLabel, paymentStatusLabel, paymentTone, quoteStatusLabel, shipmentStatusLabel, shipmentTone } from "@/features/account/status";

const filters = ["", "pending_payment", "awaiting_transfer", "awaiting_supplier", "preparing", "shipped", "delivered", "incident", "cancelled"];
// q is matched against number, email and last name

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["sales", "inventory"]);
  let q = staff.sb.from("orders").select("id, number, status, payment_status, shipping_quote_status, total, payment_method, created_at, first_name, last_name, city, order_items(fulfillment_type), shipments(status)").order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) q = q.or(`number.ilike.%${sp.q.replace(/[%,()]/g, "")}%,email.ilike.%${sp.q.replace(/[%,()]/g, "")}%,last_name.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Pedidos" eyebrow="Ventas" />
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f} href={f ? `/admin/orders?status=${f}` : "/admin/orders"} className={`border px-3 py-1.5 text-xs ${sp.status === f || (!sp.status && !f) ? "border-paper text-paper" : "border-line text-smoke"}`}>
            {f ? orderStatusLabel[f] : "Todos"}
          </Link>
        ))}
      </div>
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Número, correo o apellido" className="field max-w-sm" />{sp.status && <input type="hidden" name="status" value={sp.status} />}<button className="btn btn-ghost">Buscar</button></form>
      <Table head={["Pedido", "Cliente", "Tipo", "Pago", "Pedido", "Envío", "Total"]} empty={!data?.length}>
        {data?.map((o) => {
          const items = o.order_items as { fulfillment_type: string }[];
          const onOrder = items.some((i) => i.fulfillment_type === "on_order");
          return (
            <tr key={o.id}>
              <Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link><br /><span className="text-xs text-smoke">{formatDate(o.created_at)}</span></Td>
              <Td>{o.first_name} {o.last_name}<br /><span className="text-xs text-smoke">{o.city}</span></Td>
              <Td>{onOrder ? <Pill tone="warn">Bajo pedido</Pill> : <Pill>Propio</Pill>}</Td>
              <Td>
                {paymentMethodLabel[o.payment_method] ?? o.payment_method}
                <br />
                <Pill tone={paymentTone(o.payment_status)}>{paymentStatusLabel[o.payment_status] ?? o.payment_status}</Pill>
              </Td>
              <Td><Pill tone={orderTone(o.status)}>{orderStatusLabel[o.status]}</Pill></Td>
              <Td>
                {(() => {
                  const sh = (Array.isArray(o.shipments) ? o.shipments[0] : o.shipments) as { status: string } | null;
                  if (o.shipping_quote_status === "pending" || o.shipping_quote_status === "quoted") return <Pill tone="warn">{quoteStatusLabel[o.shipping_quote_status]}</Pill>;
                  return sh ? <Pill tone={shipmentTone(sh.status)}>{shipmentStatusLabel[sh.status]}</Pill> : <span className="text-xs text-smoke">—</span>;
                })()}
              </Td>
              <Td>{formatCOP(o.total)}</Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
