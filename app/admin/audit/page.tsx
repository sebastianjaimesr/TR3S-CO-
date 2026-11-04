import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td, Pill } from "@/features/admin/ui";

export default async function AuditAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["admin"]);
  let q = staff.sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  if (sp.entity) q = q.eq("entity", sp.entity);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Auditoría" eyebrow="Seguridad" />
      <form className="mb-4 flex gap-2">
        <select name="entity" defaultValue={sp.entity ?? ""} className="field max-w-xs">
          <option value="">Todas las entidades</option>
          {["products", "product_variants", "orders", "payments", "supplier_stock", "suppliers", "user_roles", "store_settings", "coupons", "promotions", "homepage_campaigns", "brands", "shipments"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <button className="btn btn-ghost">Filtrar</button>
      </form>
      <Table head={["Fecha", "Acción", "Entidad", "Actor", "Detalle"]} empty={!data?.length}>
        {data?.map((a) => (
          <tr key={a.id}>
            <Td className="text-xs">{new Date(a.created_at).toLocaleString("es-CO")}</Td>
            <Td><Pill>{a.action}</Pill></Td>
            <Td>{a.entity}<br /><span className="text-xs text-smoke">{a.entity_id}</span></Td>
            <Td className="text-xs">{a.actor_id ?? "sistema"}</Td>
            <Td><details className="text-xs"><summary className="cursor-pointer text-smoke">ver</summary><pre className="mt-2 max-w-xl overflow-x-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(a.data, null, 1)}</pre></details></Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
