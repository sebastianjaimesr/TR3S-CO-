import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td } from "@/features/admin/ui";
import { formatDate } from "@/lib/format";

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["sales"]);
  let q = staff.sb.from("customers").select("id, first_name, last_name, email, phone, city, created_at, orders(count)").order("created_at", { ascending: false }).limit(300);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, "");
    q = q.or(`email.ilike.%${t}%,first_name.ilike.%${t}%,last_name.ilike.%${t}%,phone.ilike.%${t}%`);
  }
  const { data } = await q;
  return (
    <>
      <PageHeader title="Clientes" eyebrow="Ventas" />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Nombre, correo o teléfono" className="field max-w-sm" /><button className="btn btn-ghost">Buscar</button></form>
      <Table head={["Cliente", "Contacto", "Ciudad", "Pedidos", "Desde"]} empty={!data?.length}>
        {data?.map((c) => (
          <tr key={c.id}>
            <Td><Link href={`/admin/customers/${c.id}`} className="underline">{c.first_name} {c.last_name}</Link></Td>
            <Td>{c.email}<br /><span className="text-xs text-smoke">{c.phone}</span></Td>
            <Td>{c.city}</Td>
            <Td>{(c.orders as { count: number }[])[0]?.count ?? 0}</Td>
            <Td className="text-xs">{formatDate(c.created_at)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
