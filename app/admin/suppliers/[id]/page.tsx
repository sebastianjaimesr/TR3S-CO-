import { notFound } from "next/navigation";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Table, Td, Pill, Check } from "@/features/admin/ui";
import { confirmSupplierStock, linkSupplierVariant, saveSupplier } from "@/features/admin/actions/operations";
import { formatCOP, formatDate } from "@/lib/format";

export default async function SupplierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const staff = await requireStaff(["inventory", "sales"]);
  const [{ data: s }, { data: stock }, { data: settings }] = await Promise.all([
    staff.sb.from("suppliers").select("*").eq("id", id).maybeSingle(),
    staff.sb.from("supplier_stock").select("*, variant:product_variants(sku, size, color, product:products(name, price)), supplier_confirmations(quantity_reported, is_available, notes, confirmed_at)").eq("supplier_id", id).order("updated_at", { ascending: false }),
    staff.sb.from("store_settings").select("supplier_confirmation_max_age_days").eq("id", 1).single(),
  ]);
  if (!s) notFound();
  const maxAge = (settings?.supplier_confirmation_max_age_days ?? 7) * 86400000;
  const edit = can(staff, ["inventory"]);
  return (
    <>
      <PageHeader title={s.name} eyebrow="Proveedor" />
      <Flash sp={await searchParams} />
      <form action={saveSupplier} className="grid gap-3 md:grid-cols-3">
        <input type="hidden" name="id" value={s.id} />
        <Field label="Nombre comercial" name="name" defaultValue={s.name} required />
        <Field label="Razón social" name="legal_name" defaultValue={s.legal_name} />
        <Field label="NIT" name="tax_id" defaultValue={s.tax_id} />
        <Field label="Contacto" name="contact_name" defaultValue={s.contact_name} />
        <Field label="Teléfono / WhatsApp" name="phone" defaultValue={s.phone} />
        <Field label="Correo" name="email" defaultValue={s.email} />
        <Field label="Ciudad" name="city" defaultValue={s.city} />
        <Field label="Catálogo (URL)" name="catalog_url" defaultValue={s.catalog_url} />
        <div className="flex items-end"><Check label="Activo" name="is_active" defaultChecked={s.is_active} /></div>
        <TextArea label="Condiciones comerciales" name="conditions" defaultValue={s.conditions} rows={2} className="md:col-span-3" />
        <TextArea label="Notas" name="notes" defaultValue={s.notes} rows={2} className="md:col-span-3" />
        {edit && <button className="btn btn-ghost md:w-fit">Guardar</button>}
      </form>

      <h2 className="mt-12 mb-3 font-display text-lg font-semibold">Referencias ofrecidas</h2>
      <p className="mb-4 text-xs text-smoke">Una referencia solo se vende “bajo pedido” si la confirmación tiene menos de {settings?.supplier_confirmation_max_age_days ?? 7} días. Las unidades se descuentan al recibir pedidos.</p>
      <Table head={["SKU", "Producto", "Costo / precio", "Disponible", "Entrega", "Última confirmación", "Confirmar ahora"]} empty={!stock?.length}>
        {stock?.map((r) => {
          const v = r.variant as unknown as { sku: string; size: string; color: string; product: { name: string; price: number } };
          const stale = !r.confirmed_at || Date.now() - new Date(r.confirmed_at).getTime() > maxAge;
          const history = (r.supplier_confirmations as { quantity_reported: number; is_available: boolean; notes: string | null; confirmed_at: string }[]).sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at));
          return (
            <tr key={r.id}>
              <Td className="text-xs">{v.sku}{r.supplier_sku && <><br /><span className="text-smoke">prov: {r.supplier_sku}</span></>}</Td>
              <Td>{v.product.name}<br /><span className="text-xs text-smoke">T{v.size} · {v.color}</span></Td>
              <Td>{formatCOP(r.supplier_cost)}<br /><span className="text-xs text-smoke">venta {formatCOP(v.product.price)}</span></Td>
              <Td>{r.is_available ? r.quantity_reported : <Pill tone="bad">No</Pill>}</Td>
              <Td>{r.lead_time_days} días</Td>
              <Td>
                {r.confirmed_at ? formatDate(r.confirmed_at) : "—"} {stale && <Pill tone="warn">Vencida</Pill>}
                <details className="mt-1 text-xs text-smoke"><summary className="cursor-pointer">Historial ({history.length})</summary>
                  <ul className="mt-1 space-y-1">{history.slice(0, 10).map((h, n) => <li key={n}>{formatDate(h.confirmed_at)} · {h.is_available ? `${h.quantity_reported} u.` : "sin stock"}{h.notes ? ` · ${h.notes}` : ""}</li>)}</ul>
                </details>
              </Td>
              <Td>
                <form action={confirmSupplierStock} className="flex flex-wrap gap-1">
                  <input type="hidden" name="supplier_id" value={id} />
                  <input type="hidden" name="supplier_stock_id" value={r.id} />
                  <input name="quantity" type="number" min={0} defaultValue={r.quantity_reported} className="field h-9 min-h-0 w-16 text-xs" aria-label="Cantidad confirmada" />
                  <input name="lead_time_days" type="number" min={0} defaultValue={r.lead_time_days} className="field h-9 min-h-0 w-14 text-xs" aria-label="Días de entrega" />
                  <input name="notes" placeholder="nota" className="field h-9 min-h-0 w-24 text-xs" aria-label="Nota" />
                  <button className="btn btn-ghost h-9 min-h-0 px-2 text-[10px]">OK</button>
                </form>
              </Td>
            </tr>
          );
        })}
      </Table>

      {edit && (
        <form action={linkSupplierVariant} className="mt-6 grid gap-3 border border-line p-4 md:grid-cols-6">
          <input type="hidden" name="supplier_id" value={id} />
          <p className="eyebrow md:col-span-6">Vincular referencia del proveedor a una variante (SKU de TR3S)</p>
          <Field label="SKU TR3S" name="sku" required />
          <Field label="SKU proveedor" name="supplier_sku" />
          <Field label="Costo proveedor" name="supplier_cost" type="number" required />
          <Field label="Cantidad reportada" name="quantity_reported" type="number" required />
          <Field label="Días de entrega" name="lead_time_days" type="number" defaultValue={5} />
          <button className="btn btn-primary h-12 self-end">Vincular</button>
        </form>
      )}
    </>
  );
}
