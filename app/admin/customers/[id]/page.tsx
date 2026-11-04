import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Table, Td, Pill } from "@/features/admin/ui";
import { saveCustomerNotes } from "@/features/admin/actions/operations";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel } from "@/features/account/status";
import { whatsappLink } from "@/services/whatsapp";

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const staff = await requireStaff(["sales"]);
  const [{ data: c }, { data: orders }] = await Promise.all([
    staff.sb.from("customers").select("*").eq("id", id).maybeSingle(),
    staff.sb.from("orders").select("id, number, status, total, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();
  const spent = (orders ?? []).filter((o) => !["cancelled", "pending_payment", "awaiting_transfer"].includes(o.status)).reduce((a, o) => a + o.total, 0);
  const wa = whatsappLink(c.phone, `Hola ${c.first_name}, te escribimos de TR3S & CO.`);
  return (
    <>
      <PageHeader title={`${c.first_name} ${c.last_name}`} eyebrow="Cliente" actions={wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost h-10 min-h-0">WhatsApp</a> : null} />
      <Flash sp={await searchParams} />
      <div className="grid gap-8 lg:grid-cols-3">
        <form action={saveCustomerNotes} className="space-y-3 border border-line p-5 text-sm">
          <input type="hidden" name="id" value={c.id} />
          <p>{c.email}</p>
          <Field label="Teléfono" name="phone" defaultValue={c.phone} />
          <p className="text-bone/80">{c.address}<br />{c.city}, {c.department}</p>
          <p className="text-smoke">Cliente desde {formatDate(c.created_at)} · Total comprado {formatCOP(spent)}</p>
          <TextArea label="Observaciones internas" name="notes" defaultValue={c.notes} rows={4} />
          <button className="btn btn-ghost h-10 min-h-0">Guardar</button>
        </form>
        <div className="lg:col-span-2">
          <Table head={["Pedido", "Fecha", "Estado", "Total"]} empty={!orders?.length}>
            {orders?.map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/orders/${o.id}`} className="underline">{o.number}</Link></Td>
                <Td>{formatDate(o.created_at)}</Td>
                <Td><Pill>{orderStatusLabel[o.status]}</Pill></Td>
                <Td>{formatCOP(o.total)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
