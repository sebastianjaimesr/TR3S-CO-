import { requireStaff } from "@/lib/auth";
import { PageHeader, Pill, Stat, Table, Td, Notice } from "@/features/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Newsletter" };

export default async function NewsletterAdmin() {
  const staff = await requireStaff(["sales"]);
  const { data, error } = await staff.sb
    .from("newsletter_subscribers")
    .select("id, email, source, consent_at, unsubscribed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const active = data?.filter((s) => !s.unsubscribed_at).length ?? 0;
  return (
    <>
      <PageHeader title="Newsletter" eyebrow="Ventas" />
      {error && <Notice kind="error">No se pudo cargar la lista: {error.message}</Notice>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Suscriptores activos" value={active} />
        <Stat label="Registros totales" value={data?.length ?? 0} hint="Incluye bajas" />
      </div>
      <Table head={["Correo", "Origen", "Consentimiento", "Estado"]} empty={!data?.length}>
        {data?.map((s) => (
          <tr key={s.id}>
            <Td>{s.email}</Td>
            <Td className="text-xs">{s.source}</Td>
            <Td className="text-xs">{formatDate(s.consent_at)}</Td>
            <Td>{s.unsubscribed_at ? <Pill tone="muted">Baja</Pill> : <Pill tone="ok">Activo</Pill>}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
