import Link from "next/link";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Table, Td, Pill } from "@/features/admin/ui";
import { saveSupplier } from "@/features/admin/actions/operations";

export default async function SuppliersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["inventory", "sales"]);
  const { data } = await staff.sb.from("suppliers").select("id, name, contact_name, phone, city, is_active, supplier_stock(count)").order("name");
  return (
    <>
      <PageHeader title="Proveedores" eyebrow="Venta bajo pedido" />
      <Flash sp={await searchParams} />
      <Table head={["Proveedor", "Contacto", "Ciudad", "Referencias", "Estado"]} empty={!data?.length}>
        {data?.map((s) => (
          <tr key={s.id}>
            <Td><Link href={`/admin/suppliers/${s.id}`} className="underline">{s.name}</Link></Td>
            <Td>{s.contact_name}<br /><span className="text-xs text-smoke">{s.phone}</span></Td>
            <Td>{s.city}</Td>
            <Td>{(s.supplier_stock as { count: number }[])[0]?.count ?? 0}</Td>
            <Td>{s.is_active ? <Pill tone="ok">Activo</Pill> : <Pill>Inactivo</Pill>}</Td>
          </tr>
        ))}
      </Table>
      {can(staff, ["inventory"]) && (
        <form action={saveSupplier} className="mt-10 grid gap-3 border border-line p-4 md:grid-cols-3">
          <p className="eyebrow md:col-span-3">Nuevo proveedor (solo proveedores reales y verificados)</p>
          <Field label="Nombre comercial" name="name" required />
          <Field label="Razón social" name="legal_name" />
          <Field label="NIT" name="tax_id" />
          <Field label="Contacto" name="contact_name" />
          <Field label="Teléfono / WhatsApp" name="phone" />
          <Field label="Correo" name="email" type="email" />
          <Field label="Ciudad" name="city" />
          <Field label="Catálogo (URL)" name="catalog_url" />
          <TextArea label="Condiciones comerciales" name="conditions" rows={2} className="md:col-span-3" />
          <button className="btn btn-primary md:w-fit">Crear proveedor</button>
        </form>
      )}
    </>
  );
}
