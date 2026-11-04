import Link from "next/link";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Field, Table, Td, Pill, Select } from "@/features/admin/ui";
import { moveInventory } from "@/features/admin/actions/operations";
import { formatCOP, formatDate } from "@/lib/format";

export default async function InventoryAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["inventory", "sales"]);
  const [{ data: stock }, { data: moves }, { data: settings }] = await Promise.all([
    staff.sb.from("inventory").select("id, location, quantity, reserved, unit_cost, entered_at, variant:product_variants(sku, size, color, product:products(name, brands(name)))").order("updated_at", { ascending: false }).limit(300),
    staff.sb.from("inventory_movements").select("id, type, quantity, location, note, created_at, order_id, variant:product_variants(sku)").order("created_at", { ascending: false }).limit(50),
    staff.sb.from("store_settings").select("low_stock_threshold").eq("id", 1).single(),
  ]);
  const low = settings?.low_stock_threshold ?? 2;
  const rows = (stock ?? []).filter((r) => !sp.q || JSON.stringify(r.variant).toLowerCase().includes(sp.q.toLowerCase()));
  return (
    <>
      <PageHeader title="Inventario propio" eyebrow="Operación" actions={<Link href="/admin/suppliers" className="btn btn-ghost h-10 min-h-0">Inventario de proveedores →</Link>} />
      <Flash sp={sp} />
      {can(staff, ["inventory"]) && (
        <form action={moveInventory} className="mb-10 grid gap-3 border border-line p-4 md:grid-cols-7">
          <p className="eyebrow md:col-span-7">Registrar movimiento</p>
          <Field label="SKU" name="sku" required className="md:col-span-2" />
          <Select label="Tipo" name="type" options={[{ value: "entry", label: "Entrada (compra)" }, { value: "exit", label: "Salida (venta física, daño)" }, { value: "adjustment", label: "Ajuste (+/−)" }]} />
          <Field label="Cantidad" name="quantity" type="number" required />
          <Field label="Costo unitario" name="unit_cost" type="number" hint="Solo en entradas" />
          <Field label="Ubicación" name="location" defaultValue="bodega-principal" />
          <Field label="Nota" name="note" />
          <button className="btn btn-primary md:col-span-7 md:w-fit">Registrar</button>
          <p className="text-xs text-smoke md:col-span-7">Las ventas por WhatsApp o Instagram también deben registrarse aquí como salida para evitar sobreventa en la web.</p>
        </form>
      )}
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Filtrar por SKU, modelo o marca" className="field max-w-sm" /><button className="btn btn-ghost">Filtrar</button></form>
      <Table head={["SKU", "Producto", "Ubicación", "Cantidad", "Reservado", "Libre", "Costo", "Entrada"]} empty={!rows.length}>
        {rows.map((r) => {
          const v = r.variant as unknown as { sku: string; size: string; color: string; product: { name: string; brands: { name: string } } };
          const free = r.quantity - r.reserved;
          return (
            <tr key={r.id}>
              <Td className="text-xs">{v.sku}</Td>
              <Td>{v.product.brands.name} {v.product.name}<br /><span className="text-xs text-smoke">T{v.size} · {v.color}</span></Td>
              <Td>{r.location}</Td>
              <Td>{r.quantity}</Td>
              <Td>{r.reserved}</Td>
              <Td>{free <= 0 ? <Pill tone="bad">Agotado</Pill> : free <= low ? <Pill tone="warn">{free} · bajo</Pill> : free}</Td>
              <Td>{r.unit_cost != null ? formatCOP(r.unit_cost) : "—"}</Td>
              <Td className="text-xs">{formatDate(r.entered_at)}</Td>
            </tr>
          );
        })}
      </Table>
      <h2 className="mt-10 mb-3 font-display text-lg font-semibold">Últimos movimientos</h2>
      <Table head={["Fecha", "SKU", "Tipo", "Cantidad", "Ubicación", "Nota"]} empty={!moves?.length}>
        {moves?.map((m) => (
          <tr key={m.id}>
            <Td className="text-xs">{new Date(m.created_at).toLocaleString("es-CO")}</Td>
            <Td className="text-xs">{(m.variant as unknown as { sku: string })?.sku}</Td>
            <Td><Pill>{m.type}</Pill></Td>
            <Td>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
            <Td>{m.location}</Td>
            <Td className="text-xs text-smoke">{m.note}{m.order_id && <> · <Link href={`/admin/orders/${m.order_id}`} className="underline">pedido</Link></>}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
