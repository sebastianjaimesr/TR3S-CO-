import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Table, Td, Pill, Field, TextArea } from "@/features/admin/ui";
import { confirmSupplierItem, confirmTransfer, saveStaffNotes, setStatus, shipOrder } from "@/features/admin/actions/orders";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel } from "@/features/account/status";
import { orderFollowUpMessage, whatsappLink } from "@/services/whatsapp";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const staff = await requireStaff(["sales", "inventory"]);
  const [{ data: o }, { data: items }, { data: events }, { data: payments }, { data: shipment }] = await Promise.all([
    staff.sb.from("orders").select("*").eq("id", id).maybeSingle(),
    staff.sb.from("order_items").select("*, supplier_stock(supplier:suppliers(name, phone))").eq("order_id", id),
    staff.sb.from("order_events").select("*").eq("order_id", id).order("created_at"),
    staff.sb.from("payments").select("*").eq("order_id", id).order("created_at"),
    staff.sb.from("shipments").select("*").eq("order_id", id).maybeSingle(),
  ]);
  if (!o) notFound();
  const sales = can(staff, ["sales"]);
  const wa = whatsappLink(o.phone, orderFollowUpMessage(o.number).replace("Hola TR3S & CO. Quiero hacer seguimiento a mi pedido", `Hola ${o.first_name}, te escribimos de TR3S & CO. sobre tu pedido`));

  return (
    <>
      <PageHeader title={`Pedido ${o.number}`} eyebrow={formatDate(o.created_at)} actions={<Pill tone={o.status === "incident" ? "bad" : "warn"}>{orderStatusLabel[o.status]}</Pill>} />
      <Flash sp={await searchParams} />
      <div className="grid gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <Table head={["Producto", "Tipo", "Cant.", "Precio", "Costo", "Proveedor"]}>
            {items?.map((i) => {
              const sup = (i.supplier_stock as { supplier: { name: string; phone: string | null } } | null)?.supplier;
              return (
                <tr key={i.id}>
                  <Td>{i.brand_name} {i.product_name}<br /><span className="text-xs text-smoke">{i.sku} · T{i.size} · {i.color}</span></Td>
                  <Td>{i.fulfillment_type === "own" ? <Pill>Propio · {i.location}</Pill> : <Pill tone="warn">Bajo pedido · {i.lead_time_days}d</Pill>}</Td>
                  <Td>{i.quantity}</Td>
                  <Td>{formatCOP(i.unit_price)}</Td>
                  <Td>{i.unit_cost != null ? formatCOP(i.unit_cost) : "—"}</Td>
                  <Td>
                    {i.fulfillment_type === "on_order" ? (
                      i.supplier_confirmed_at ? (
                        <Pill tone="ok">Confirmado {formatDate(i.supplier_confirmed_at)}</Pill>
                      ) : o.paid_at ? (
                        <form action={confirmSupplierItem} className="space-y-1">
                          <p className="text-xs">{sup?.name}{sup?.phone ? ` · ${sup.phone}` : ""}</p>
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="item_id" value={i.id} />
                          <input name="notes" placeholder="Nota (opcional)" className="field h-9 min-h-0 text-xs" />
                          <div className="flex gap-1">
                            <button name="available" value="yes" className="btn btn-ghost h-8 min-h-0 px-2 text-[10px]">Sí tiene</button>
                            <button name="available" value="no" className="btn h-8 min-h-0 border border-crimson/60 px-2 text-[10px] text-crimson">No tiene</button>
                          </div>
                        </form>
                      ) : (
                        <span className="text-xs text-smoke">Confirmar tras el pago</span>
                      )
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-smoke">Subtotal</dt><dd>{formatCOP(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between"><dt className="text-smoke">Descuento {o.coupon_code}</dt><dd>−{formatCOP(o.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-smoke">Envío</dt><dd>{formatCOP(o.shipping)}</dd></div>
            <div className="flex justify-between font-display text-lg"><dt>Total</dt><dd>{formatCOP(o.total)}</dd></div>
          </dl>

          <h2 className="mt-10 mb-3 font-display text-lg font-semibold">Pagos</h2>
          <Table head={["Medio", "Transacción", "Estado", "Monto", "Fecha"]} empty={!payments?.length}>
            {payments?.map((p) => (
              <tr key={p.id}><Td>{p.provider}</Td><Td className="text-xs">{p.transaction_id}</Td><Td><Pill tone={p.status === "approved" ? "ok" : "bad"}>{p.status}</Pill></Td><Td>{formatCOP(p.amount)}</Td><Td>{formatDate(p.created_at)}</Td></tr>
            ))}
          </Table>

          {sales && o.status === "awaiting_transfer" && (
            <form action={confirmTransfer} className="mt-4 grid gap-3 border border-line p-4 md:grid-cols-4">
              <input type="hidden" name="order_id" value={o.id} />
              <p className="eyebrow md:col-span-4">Confirmar transferencia recibida (verifica en el banco primero)</p>
              <Field label="Referencia bancaria" name="reference" required />
              <Field label="Monto recibido" name="amount" type="number" defaultValue={o.total} required />
              <Field label="Nota" name="note" />
              <button className="btn btn-primary h-12 self-end">Confirmar pago</button>
            </form>
          )}

          <h2 className="mt-10 mb-3 font-display text-lg font-semibold">Historial</h2>
          <ol className="space-y-2 border-l border-line pl-4 text-sm">
            {events?.map((e) => (
              <li key={e.id}><span className="text-smoke">{new Date(e.created_at).toLocaleString("es-CO")}</span> · {e.status ? orderStatusLabel[e.status] : ""} {e.note && <span className="text-bone/70">— {e.note}</span>}</li>
            ))}
          </ol>
        </section>

        <aside className="space-y-6">
          <div className="border border-line bg-coal p-5 text-sm">
            <p className="eyebrow mb-2">Cliente</p>
            <p className="font-medium">{o.first_name} {o.last_name}</p>
            <p>{o.email}</p>
            <p>{o.phone}</p>
            <p className="mt-2 text-bone/80">{o.address}{o.address_notes ? ` · ${o.address_notes}` : ""}<br />{o.city}, {o.department}</p>
            <div className="mt-3 flex gap-3">
              <Link href={`/admin/customers/${o.customer_id}`} className="underline">Ver cliente</Link>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>}
            </div>
          </div>

          {shipment && (
            <div className="border border-line p-5 text-sm">
              <p className="eyebrow mb-2">Despacho</p>
              <p>{shipment.carrier} · guía {shipment.tracking_number}</p>
              <p className="text-smoke">Enviado {formatDate(shipment.shipped_at)}{shipment.delivered_at ? ` · entregado ${formatDate(shipment.delivered_at)}` : ""}</p>
            </div>
          )}

          {sales && o.status === "preparing" && (
            <form action={shipOrder} className="space-y-3 border border-line p-5">
              <p className="eyebrow">Registrar despacho</p>
              <input type="hidden" name="order_id" value={o.id} />
              <Field label="Transportadora" name="carrier" required placeholder="Servientrega, Interrapidísimo, Coordinadora…" />
              <Field label="Número de guía" name="tracking" required />
              <button className="btn btn-primary w-full">Marcar despachado</button>
            </form>
          )}

          {sales && (
            <form action={setStatus} className="space-y-3 border border-line p-5">
              <p className="eyebrow">Cambiar estado</p>
              <input type="hidden" name="order_id" value={o.id} />
              <select name="status" className="field" defaultValue="">
                <option value="" disabled>Selecciona…</option>
                {o.status === "shipped" && <option value="delivered">Entregado</option>}
                {o.status === "awaiting_supplier" && <option value="preparing">En preparación (proveedor confirmado)</option>}
                {o.status === "incident" && o.paid_at && <option value="preparing">Volver a preparación</option>}
                {!["cancelled", "delivered"].includes(o.status) && <option value="incident">Incidencia</option>}
                {!["cancelled", "shipped", "delivered"].includes(o.status) && <option value="cancelled">Cancelar (libera o reingresa stock)</option>}
              </select>
              <Field label="Nota" name="note" />
              <button className="btn btn-ghost w-full">Aplicar</button>
              {o.paid_at && <p className="text-xs text-smoke">Si cancelas un pedido pagado, gestiona el reembolso en Wompi o por transferencia.</p>}
            </form>
          )}

          {sales && (
            <form action={saveStaffNotes} className="space-y-3">
              <input type="hidden" name="order_id" value={o.id} />
              <TextArea label="Notas internas" name="staff_notes" defaultValue={o.staff_notes} rows={3} />
              <button className="btn btn-ghost h-10 min-h-0">Guardar notas</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
