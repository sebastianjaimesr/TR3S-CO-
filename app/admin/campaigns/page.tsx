import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Check, Pill } from "@/features/admin/ui";
import { saveCampaign } from "@/features/admin/actions/operations";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function CampaignsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["admin"]);
  const [{ data: campaigns }, { data: products }] = await Promise.all([
    staff.sb.from("homepage_campaigns").select("*").order("created_at", { ascending: false }),
    staff.sb.from("products").select("id, slug, name, is_active").order("name"),
  ]);
  const slugOf = (id: string) => products?.find((p) => p.id === id)?.slug ?? id;
  const form = (c?: any) => (
    <form action={saveCampaign} className="grid gap-3 md:grid-cols-2" encType="multipart/form-data">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Nombre interno" name="name" defaultValue={c?.name} required />
      <Field label="Subtítulo" name="subheadline" defaultValue={c?.subheadline ?? "FIND YOUR NEXT STEP."} />
      <TextArea label="Titular (una línea por renglón)" name="headline" defaultValue={(c?.headline ?? ["YOUR STYLE.", "YOUR MOVE."]).join("\n")} rows={2} />
      <Field label="Palabras monumentales" name="monumental_words" defaultValue={(c?.monumental_words ?? ["TR3S", "STYLE", "ATTITUDE", "MOVE"]).join(", ")} />
      <TextArea
        label="Productos del hero y carrusel (slug o referencia, en orden; el primero es el protagonista)"
        name="products"
        defaultValue={(c?.product_ids ?? []).map(slugOf).join("\n")}
        rows={4}
        className="md:col-span-2"
      />
      <div><label className="field-label">Imagen de respaldo (sin WebGL)</label><input type="file" name="fallback_image" accept="image/*" className="text-sm" />{c?.fallback_image_url && <p className="mt-1 truncate text-xs text-smoke">{c.fallback_image_url}</p>}</div>
      <Field label="Modelo 3D de campaña (URL .glb autorizado)" name="model_url" defaultValue={c?.model_url} />
      <Field label="Banner (URL imagen)" name="banner_image_url" defaultValue={c?.banner_image_url} />
      <Field label="Banner (enlace)" name="banner_link" defaultValue={c?.banner_link} />
      <Field label="Inicio" name="starts_at" type="datetime-local" defaultValue={c?.starts_at?.slice(0, 16)} />
      <Field label="Fin" name="ends_at" type="datetime-local" defaultValue={c?.ends_at?.slice(0, 16)} />
      <Check label="Activa (desactiva las demás)" name="is_active" defaultChecked={c?.is_active} />
      <button className="btn btn-primary md:w-fit">{c ? "Guardar campaña" : "Crear campaña"}</button>
    </form>
  );
  return (
    <>
      <PageHeader title="Campañas del home" eyebrow="Marketing" />
      <Flash sp={await searchParams} />
      <p className="mb-6 max-w-3xl text-sm text-smoke">Controla el producto protagonista del hero, el texto publicitario y los destacados del carrusel. Publica solo ofertas reales.</p>
      <section className="mb-10 border border-line p-4"><p className="eyebrow mb-3">Nueva campaña</p>{form()}</section>
      <div className="space-y-6">
        {campaigns?.map((c) => (
          <section key={c.id} className="border border-line p-4">
            <div className="mb-3 flex items-center gap-2"><p className="font-display font-semibold">{c.name}</p>{c.is_active ? <Pill tone="ok">Activa</Pill> : <Pill>Inactiva</Pill>}</div>
            {form(c)}
          </section>
        ))}
      </div>
    </>
  );
}
