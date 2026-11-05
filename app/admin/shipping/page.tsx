import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td, Pill, Flash, Field, Check, Select } from "@/features/admin/ui";
import { deleteShippingRate, saveShippingRate, updateShipment } from "@/features/admin/actions/commerce";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, quoteStatusLabel, shipmentStatusLabel, shipmentTone } from "@/features/account/status";
import { departments } from "@/validations/checkout";

/* eslint-disable @typescript-eslint/no-explicit-any */
const shipStatuses = ["preparing", "dispatched", "in_transit", "delivered", "delivery_issue"] as const;

export default async function ShippingAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["sales"]);
  const tab = sp.tab === "zonas" ? "zonas" : "envios";

  const [{ data: rates }, { data: orders }, { data: settings }] = await Promise.all([
    staff.sb.from("shipping_rates").select("*").order("position").order("department", { nullsFirst: false }).order("city", { nullsFirst: false }),
    staff.sb
      .from("orders")
      .select("id, number, status, shipping, shipping_quote_status, city, department, first_name, last_name, paid_at, created_at, shipments(status, carrier, tracking_number, updated_at)")
      .or("status.in.(preparing,shipped,incident),and(status.eq.pending_payment,shipping_quote_status.in.(pending,quoted))")
      .order("created_at", { ascending: true })
      .limit(200),
    staff.sb.from("store_settings").select("shipping_flat_rate, free_shipping_from, shipping_unmatched_mode").eq("id", 1).single(),
  ]);
  const ship = (o: any) => (Array.isArray(o.shipments) ? o.shipments[0] : o.shipments) as { status: string; carrier: string | null; tracking_number: string | null } | null;
  const quotes = orders?.filter((o) => o.status === "pending_payment") ?? [];
  const board = orders?.filter((o) => o.status !== "pending_payment") ?? [];

  const rateForm = (r?: any) => (
    <form action={saveShippingRate} className="grid gap-3 md:grid-cols-6">
      {r && <input type="hidden" name="id" value={r.id} />}
      <Field label="Nombre de la zona" name="name" defaultValue={r?.name} required className="md:col-span-2" placeholder="Bucaramanga y área metropolitana" />
      <Select label="Departamento" name="department" defaultValue={r?.department ?? ""} options={[{ value: "", label: "— Resto del país —" }, ...departments.map((d) => ({ value: d, label: d }))]} />
      <Field label="Ciudad (opcional)" name="city" defaultValue={r?.city} placeholder="Vacío = todo el departamento" />
      <Field label="Tarifa (COP)" name="rate" type="number" min={0} defaultValue={r?.rate ?? ""} />
      <Field label="Gratis desde (COP)" name="free_from" type="number" min={1} defaultValue={r?.free_from} />
      <Field label="Tiempo estimado" name="eta_text" defaultValue={r?.eta_text} placeholder="1–2 días hábiles" className="md:col-span-2" />
      <Field label="Orden" name="position" type="number" defaultValue={r?.position ?? 0} />
      <div className="flex flex-wrap items-end gap-4 pb-3 md:col-span-2">
        <Check label="Requiere cotización manual" name="requires_quote" defaultChecked={r?.requires_quote} />
        {r && <Check label="Activa" name="is_active" defaultChecked={r?.is_active} />}
      </div>
      <button className="btn btn-primary h-12 self-end">{r ? "Guardar" : "Crear zona"}</button>
    </form>
  );

  return (
    <>
      <PageHeader title="Envíos" eyebrow="Gestión manual" />
      <Flash sp={sp} />
      <nav className="mb-8 flex gap-2" aria-label="Secciones de envíos">
        <Link href="/admin/shipping" className={`border px-4 py-2 text-sm ${tab === "envios" ? "border-paper text-paper" : "border-line text-smoke"}`}>Despachos y cotizaciones</Link>
        <Link href="/admin/shipping?tab=zonas" className={`border px-4 py-2 text-sm ${tab === "zonas" ? "border-paper text-paper" : "border-line text-smoke"}`}>Zonas y tarifas</Link>
      </nav>

      {tab === "envios" ? (
        <>
          <section>
            <h2 className="mb-1 font-display text-lg font-semibold">Pendientes de cotización ({quotes.length})</h2>
            <p className="mb-3 text-sm text-smoke">Pedidos a zonas sin tarifa fija. No se cobra nada hasta que registres el valor y el cliente lo acepte desde el enlace de su pedido.</p>
            <Table head={["Pedido", "Destino", "Estado de cotización", ""]} empty={!quotes.length}>
              {quotes.map((o) => (
                <tr key={o.id}>
                  <Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link><br /><span className="text-xs text-smoke">{formatDate(o.created_at)}</span></Td>
                  <Td>{o.city}, {o.department}</Td>
                  <Td><Pill tone={o.shipping_quote_status === "pending" ? "warn" : "muted"}>{quoteStatusLabel[o.shipping_quote_status]}</Pill>{o.shipping_quote_status === "quoted" && <span className="ml-2 text-xs">{formatCOP(o.shipping)}</span>}</Td>
                  <Td><Link href={`/admin/orders/${o.id}#cotizar`} className="btn btn-ghost h-9 min-h-0 px-3 text-[10px]">Cotizar</Link></Td>
                </tr>
              ))}
            </Table>
          </section>

          <section className="mt-12">
            <h2 className="mb-1 font-display text-lg font-semibold">Pedidos pagados por despachar o en camino ({board.length})</h2>
            <p className="mb-3 text-sm text-smoke">Registra transportadora y guía al despachar. Los estados del envío son independientes del pago; despachar o entregar actualiza el pedido.</p>
            <Table head={["Pedido", "Cliente / destino", "Pedido", "Envío", "Actualizar"]} empty={!board.length}>
              {board.map((o) => {
                const s = ship(o);
                return (
                  <tr key={o.id}>
                    <Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link><br /><span className="text-xs text-smoke">{o.paid_at ? `Pagado ${formatDate(o.paid_at)}` : ""}</span></Td>
                    <Td>{o.first_name} {o.last_name}<br /><span className="text-xs text-smoke">{o.city}, {o.department}</span></Td>
                    <Td><Pill>{orderStatusLabel[o.status]}</Pill></Td>
                    <Td>
                      <Pill tone={shipmentTone(s?.status)}>{s ? shipmentStatusLabel[s.status] : "Sin registrar"}</Pill>
                      {s?.carrier && <span className="mt-1 block text-xs text-smoke">{s.carrier}{s.tracking_number ? ` · ${s.tracking_number}` : ""}</span>}
                    </Td>
                    <Td>
                      <form action={updateShipment} className="grid min-w-[22rem] grid-cols-2 gap-1.5">
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="back" value="board" />
                        <select name="status" defaultValue={s?.status === "preparing" || !s ? "dispatched" : s.status} className="field h-9 min-h-0 py-0 text-xs">
                          {shipStatuses.map((st) => <option key={st} value={st}>{shipmentStatusLabel[st]}</option>)}
                        </select>
                        <input name="carrier" defaultValue={s?.carrier ?? ""} placeholder="Transportadora" className="field h-9 min-h-0 text-xs" />
                        <input name="tracking" defaultValue={s?.tracking_number ?? ""} placeholder="N.º de guía" className="field h-9 min-h-0 text-xs" />
                        <input name="note" placeholder="Observación" className="field h-9 min-h-0 text-xs" />
                        <button className="btn btn-ghost col-span-2 h-9 min-h-0 text-[10px]">Guardar</button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </section>
        </>
      ) : (
        <>
          <div className="mb-6 border border-line bg-coal p-4 text-sm text-bone/80">
            <p>
              La tarifa se elige así: <strong>ciudad</strong> → <strong>departamento</strong> → <strong>resto del país</strong>. Si ninguna zona aplica se usa{" "}
              {settings?.shipping_unmatched_mode === "quote" ? (
                <strong>cotización manual</strong>
              ) : (
                <>
                  la <strong>tarifa general de {formatCOP(settings?.shipping_flat_rate ?? 0)}</strong>
                  {settings?.free_shipping_from ? ` (gratis desde ${formatCOP(settings.free_shipping_from)})` : ""}
                </>
              )}{" "}
              — se cambia en <Link href="/admin/settings" className="underline">Configuración</Link>.
            </p>
            <p className="mt-2 text-smoke">El total del pedido siempre lo recalcula la base de datos; el navegador solo muestra una estimación.</p>
          </div>
          <section className="mb-10 border border-line p-4">
            <p className="eyebrow mb-3">Nueva zona</p>
            {rateForm()}
          </section>
          <div className="space-y-4">
            {rates?.map((r) => (
              <section key={r.id} className="border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="font-display font-semibold">{r.name}</p>
                  {r.requires_quote ? <Pill tone="warn">Cotización</Pill> : <Pill>{formatCOP(r.rate)}</Pill>}
                  {!r.is_active && <Pill tone="bad">Inactiva</Pill>}
                  <form action={deleteShippingRate} className="ml-auto">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-crimson underline">Eliminar</button>
                  </form>
                </div>
                {rateForm(r)}
              </section>
            ))}
            {!rates?.length && <p className="text-sm text-smoke">Aún no hay zonas: todos los envíos usan la tarifa general.</p>}
          </div>
        </>
      )}
    </>
  );
}
