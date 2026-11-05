/* eslint-disable @next/next/no-img-element */
import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Pill } from "@/features/admin/ui";
import { clearHomeMedia } from "@/features/admin/actions/commerce";
import { HomeMediaUploader } from "@/features/admin/MediaUploader";
import { homeMediaSlots } from "@/lib/home-media";

export default async function HomeContentAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["admin"]);
  const { data } = await staff.sb.from("home_media").select("*");
  const bySlot = new Map((data ?? []).map((m) => [m.slot, m]));
  return (
    <>
      <PageHeader title="Contenido del inicio" eyebrow="Marketing" />
      <Flash sp={await searchParams} />
      <p className="mb-8 max-w-3xl text-sm text-smoke">
        Fotografías del hero, las categorías y los banners. Usa solo fotos propias o con licencia (nunca imágenes de Google ni fotos oficiales de marcas sin permiso).
        Los tres espacios «Hero» forman el escenario principal: cada tenis sobre un pedestal con aro de luz. Súbelos recortados, sin fondo, y cada uno en un ángulo distinto. El escenario aparece cuando está la foto central.
        Mientras un espacio no tenga foto, el inicio muestra un panel gráfico de marca. El producto protagonista con precio se define en <a href="/admin/campaigns" className="underline">Campañas</a> cuando exista catálogo.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {homeMediaSlots.map((s) => {
          const m = bySlot.get(s.slot);
          return (
            <section key={s.slot} className="flex flex-col border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <p className="font-display font-semibold">{s.label}</p>
                {m ? <Pill tone="ok">Con foto</Pill> : <Pill>Diseño de marca</Pill>}
              </div>
              <div className="mb-3 aspect-[16/9] overflow-hidden bg-graphite">
                {m?.image_url ? <img src={m.image_url} alt={m.alt} className={`h-full w-full ${"stage" in s && s.stage ? "object-contain" : "object-cover"}`} /> : <p className="grid h-full place-items-center text-xs text-smoke">Sin fotografía</p>}
              </div>
              <p className="mb-3 text-xs text-smoke">{s.hint}</p>
              <HomeMediaUploader slot={s.slot} alt={m?.alt ?? ""} hasImage={Boolean(m?.image_url)} stage={"stage" in s && s.stage} />
              {m && (
                <form action={clearHomeMedia} className="mt-2">
                  <input type="hidden" name="slot" value={s.slot} />
                  <button className="text-xs text-crimson underline">Quitar foto</button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
