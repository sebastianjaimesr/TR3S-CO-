import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Table, Td, Pill, Field, TextArea } from "@/features/admin/ui";
import { confirmSupplierItem, confirmTransfer, saveStaffNotes, setStatus } from "@/features/admin/actions/orders";
import { setShippingQuote, updateShipment } from "@/features/admin/actions/commerce";
import { publicEnv } from "@/lib/env";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, orderTone, paymentMethodLabel, paymentStatusLabel, paymentTone, quoteStatusLabel, shipmentStatusLabel, shipmentTone } from "@/features/account/status";
import { orderFollowUpMessage, whatsappLink } from "@/services/whatsapp";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const staff = await requireStaff(["sales", "inventory"]);
  const [{ data: o }, { data: items }, { data: events }, { data: payments }, { data: shipment }, { data: shipEvents }] = await Promise.all([
    staff.sb.from("orders").select("*").eq("id", id).maybeSingle(),
    staff.sb.from("order_items").select("*, supplier_stock(supplier:suppliers(name, phone))").eq("order_id", id),
    staff.sb.from("order_events").select("*").eq("order_id", id).order("created_at"),
    staff.sb.from("payments").select("*").eq("order_id", id).order("created_at"),
    staff.sb.from("shipments").select("*").eq("order_id", id).maybeSingle(),
    staff.sb.from("shipment_events").select("*").eq("order_id", id).order("occurred_at"),
  ]);
  if (!o) notFound();
  const sales = can(staff, ["sales"]);
  const wa = whatsappLink(o.phone, orderFollowUpMessage(o.number).replace("Hola TR3S & CO. Quiero hacer seguimiento a mi pedido", `Hola ${o.first_name}, te escribimos de TR3S & CO. sobre tu pedido`));

  return (
    <>
      <PageHeader
        title={`Pedido ${o.number}`}
        eyebrow={formatDate(o.created_at)}
        actions={
          <>
            <Pill tone={paymentTone(o.payment_status)}>Pago: {paymentStatusLabel[o.payment_status] ?? o.payment_status}</Pill>
            <Pill tone={orderTone(o.status)}>Pedido: {orderStatusLabel[o.status]}</Pill>
            <Pill tone={shipmentTone(shipment?.status)}>Envío: {shipment ? shipmentStatusLabel[shipment.status] : quoteStatusLabel[o.shipping_quote_status]}</Pill>
          </>
        }
      />
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
            <div className="flex justify-between"><dt className="text-smoke">Envío{o.shipping_zone ? ` · ${o.shipping_zone}` : ""}</dt><dd>{o.shipping_quote_status === "pending" ? "Por cotizar" : formatCOP(o.shipping)}</dd></div>
            <div className="flex justify-between font-display text-lg"><dt>Total</dt><dd>{formatCOP(o.total)}</dd></div>
          </dl>

          <h2 className="mt-10 mb-3 font-display text-lg font-semibold">Pagos</h2>
          <p className="mb-3 text-sm text-smoke">Método elegido: {paymentMethodLabel[o.payment_method] ?? o.payment_method} · intentos de pago: {o.payment_attempts}</p>
          <Table head={["Medio", "Transacción", "Estado", "Monto", "Fecha"]} empty={!payments?.length}>
            {payments?.map((p) => (
              <tr key={p.id}><Td>{paymentMethodLabel[p.provider] ?? p.provider}</Td><Td className="break-all text-xs">{p.transaction_id}</Td><Td><Pill tone={paymentTone(p.status)}>{paymentStatusLabel[p.status] ?? p.status}</Pill></Td><Td>{formatCOP(p.amount)}</Td><Td>{formatDate(p.created_at)}</Td></tr>
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

          <div className="border border-line bg-coal p-5 text-sm">
            <p className="eyebrow mb-2">Enlace del pedido para el cliente</p>
            <p className="break-all text-xs text-bone/80">{`${publicEnv.siteUrl}/checkout/result?order=${o.number}&t=${o.access_token}`}</p>
            <p className="mt-2 text-xs text-smoke">Compártelo solo con el cliente: permite ver el pedido, aceptar la cotización y pagar.</p>
          </div>

          {sales && o.status === "pending_payment" && (o.shipping_quote_status === "pending" || o.shipping_quote_status === "quoted") && (
            <form id="cotizar" action={setShippingQuote} className="space-y-3 border border-amber-300/40 p-5">
              <p className="eyebrow">Cotizar envío · {o.city}, {o.department}</p>
              <input type="hidden" name="order_id" value={o.id} />
              <Field label="Valor del envío (COP)" name="amount" type="number" min={0} defaultValue={o.shipping_quote_status === "quoted" ? o.shipping : undefined} required />
              <Field label="Nota (transportadora, plazo)" name="note" />
              <button className="btn btn-primary w-full">{o.shipping_quote_status === "quoted" ? "Actualizar cotización" : "Guardar cotización"}</button>
              <p className="text-xs text-smoke">Luego envía al cliente el enlace del pedido: allí acepta el valor y paga. No se cobra antes.</p>
            </form>
          )}

          <div className="border border-line p-5 text-sm">
            <p className="eyebrow mb-2">Envío</p>
            {shipment ? (
              <>
                <p><Pill tone={shipmentTone(shipment.status)}>{shipmentStatusLabel[shipment.status]}</Pill></p>
                {shipment.carrier && <p className="mt-2">{shipment.carrier}{shipment.tracking_number ? ` · guía ${shipment.tracking_number}` : ""}</p>}
                <p className="text-smoke">
                  {shipment.shipped_at ? `Despachado ${formatDate(shipment.shipped_at)}` : "Sin despachar"}
                  {shipment.delivered_at ? ` · entregado ${formatDate(shipment.delivered_at)}` : ""}
                  {shipment.estimated_delivery ? ` · estimado ${formatDate(shipment.estimated_delivery)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-smoke">{o.paid_at ? "Por preparar." : "Se habilita cuando el pago esté confirmado."}</p>
            )}
            {shipEvents && shipEvents.length > 0 && (
              <ol className="mt-3 space-y-1 border-l border-line pl-3 text-xs text-smoke">
                {shipEvents.map((e) => (
                  <li key={e.id}>{new Date(e.occurred_at).toLocaleString("es-CO")} · {shipmentStatusLabel[e.status]}{e.note ? ` — ${e.note}` : ""}</li>
                ))}
              </ol>
            )}
            {sales && o.paid_at && !["cancelled"].includes(o.status) && (
              <form action={updateShipment} className="mt-4 space-y-3 border-t border-line pt-4">
                <input type="hidden" name="order_id" value={o.id} />
                <div>
                  <label htmlFor="ship-status" className="field-label">Estado del envío</label>
                  <select id="ship-status" name="status" className="field" defaultValue={!shipment || shipment.status === "preparing" ? "dispatched" : shipment.status}>
                    {(["preparing", "dispatched", "in_transit", "delivered", "delivery_issue"] as const).map((st) => <option key={st} value={st}>{shipmentStatusLabel[st]}</option>)}
                  </select>
                </div>
                <Field label="Transportadora" name="carrier" defaultValue={shipment?.carrier} placeholder="Servientrega, Interrapidísimo, Coordinadora…" />
                <Field label="Número de guía" name="tracking" defaultValue={shipment?.tracking_number} />
                <Field label="Fecha del evento" name="occurred_at" type="datetime-local" hint="Vacío = ahora" />
                <Field label="Entrega estimada" name="estimated_delivery" type="date" defaultValue={shipment?.estimated_delivery} />
                <Field label="Observación / novedad" name="note" />
                <button className="btn btn-primary w-full">Actualizar envío</button>
              </form>
            )}
          </div>

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
              {o.paid_at && <p className="text-xs text-smoke">Si cancelas un pedido pagado, gestiona el reembolso en {paymentMethodLabel[o.payment_method] ?? "la pasarela"} o por transferencia.</p>}
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
