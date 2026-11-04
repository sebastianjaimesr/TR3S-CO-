import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Table, Td, Pill, LinkButton, Flash } from "@/features/admin/ui";
import { formatCOP } from "@/lib/format";

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const staff = await requireStaff(["inventory"]);
  let q = staff.sb
    .from("products")
    .select("id, name, slug, reference, price, compare_at_price, is_active, is_demo, brand:brands(name), category:categories(name), product_variants(count)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.q) q = q.or(`name.ilike.%${sp.q.replace(/[%,()]/g, "")}%,reference.ilike.%${sp.q.replace(/[%,()]/g, "")}%`);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Productos" eyebrow="Catálogo" actions={<LinkButton href="/admin/products/new" kind="primary">Nuevo producto</LinkButton>} />
      <Flash sp={sp} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="Buscar por nombre o referencia" className="field max-w-sm" /><button className="btn btn-ghost">Buscar</button></form>
      <Table head={["Producto", "Marca / categoría", "Precio", "Variantes", "Estado"]} empty={!data?.length}>
        {data?.map((p) => {
          const brand = p.brand as unknown as { name: string } | null;
          const cat = p.category as unknown as { name: string } | null;
          const variants = (p.product_variants as unknown as { count: number }[])[0]?.count ?? 0;
          return (
            <tr key={p.id}>
              <Td><Link href={`/admin/products/${p.id}`} className="font-medium underline">{p.name}</Link><br /><span className="text-xs text-smoke">{p.reference}</span></Td>
              <Td>{brand?.name}<br /><span className="text-xs text-smoke">{cat?.name}</span></Td>
              <Td>{formatCOP(p.price)}{p.compare_at_price && <><br /><s className="text-xs text-smoke">{formatCOP(p.compare_at_price)}</s></>}</Td>
              <Td>{variants}</Td>
              <Td className="space-x-1">{p.is_active ? <Pill tone="ok">Publicado</Pill> : <Pill>Borrador</Pill>}{p.is_demo && <Pill tone="warn">Demo</Pill>}</Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
