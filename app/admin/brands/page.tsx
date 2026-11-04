import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Check, Pill } from "@/features/admin/ui";
import { saveBrand } from "@/features/admin/actions/operations";

export default async function BrandsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["inventory"]);
  const { data: brands } = await staff.sb.from("brands").select("*, products(count)").order("name");
  const form = (b?: Record<string, unknown>) => (
    <form action={saveBrand} className="grid gap-3 md:grid-cols-6" encType="multipart/form-data">
      {b && <input type="hidden" name="id" value={String(b.id)} />}
      <Field label="Nombre" name="name" defaultValue={b?.name as string} required className="md:col-span-2" />
      <Field label="Slug" name="slug" defaultValue={b?.slug as string} />
      <div className="md:col-span-2"><label className="field-label">Logo (PNG/SVG/WEBP)</label><input type="file" name="logo" accept="image/png,image/svg+xml,image/webp" className="text-sm" /></div>
      <div className="flex items-end"><Check label="Activa" name="is_active" defaultChecked={(b?.is_active as boolean) ?? true} /></div>
      <TextArea label="Descripción" name="description" defaultValue={b?.description as string} rows={2} className="md:col-span-5" />
      <button className="btn btn-ghost h-12 self-end">{b ? "Guardar" : "Crear marca"}</button>
    </form>
  );
  return (
    <>
      <PageHeader title="Marcas" eyebrow="Catálogo" />
      <Flash sp={await searchParams} />
      <p className="mb-6 max-w-3xl text-sm text-smoke">Registra solo marcas que comercializas legítimamente. No uses su logo como identidad propia ni afirmes distribución oficial sin autorización.</p>
      <section className="mb-10 border border-line p-4">{form()}</section>
      <div className="space-y-4">
        {brands?.map((b) => (
          <div key={b.id} className="border border-line p-4">
            <div className="mb-3 flex items-center gap-3">
              {b.logo_url && <Image src={b.logo_url} alt="" width={60} height={30} className="h-8 w-auto object-contain" />}
              <p className="font-display font-semibold">{b.name}</p>
              <Pill>{(b.products as { count: number }[])[0]?.count ?? 0} productos</Pill>
              {!b.is_active && <Pill tone="bad">Inactiva</Pill>}
              {b.is_demo && <Pill tone="warn">Demo</Pill>}
            </div>
            {form(b)}
          </div>
        ))}
      </div>
    </>
  );
}
