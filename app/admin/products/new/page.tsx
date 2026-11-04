import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Notice } from "@/features/admin/ui";
import { ProductForm } from "@/features/admin/ProductForm";

export default async function NewProduct({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["inventory"]);
  const [{ data: brands }, { data: categories }] = await Promise.all([
    staff.sb.from("brands").select("id, name").order("name"),
    staff.sb.from("categories").select("id, name").order("position"),
  ]);
  return (
    <>
      <PageHeader title="Nuevo producto" eyebrow="Catálogo" />
      <Flash sp={await searchParams} />
      {!brands?.length && <Notice kind="error">Primero crea al menos una marca en Marcas.</Notice>}
      <ProductForm brands={brands ?? []} categories={categories ?? []} />
    </>
  );
}
