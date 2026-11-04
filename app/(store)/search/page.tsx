import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "Buscar", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  return (
    <>
      <form role="search" action="/search" className="mx-auto max-w-[1600px] px-4 pt-10 md:px-8">
        <label htmlFor="q" className="eyebrow">Buscar marca, modelo o referencia</label>
        <div className="mt-3 flex gap-2">
          <input id="q" name="q" type="search" defaultValue={q} className="field font-display text-lg" placeholder="Ej: running negro 42" />
          <button className="btn btn-primary" type="submit">Buscar</button>
        </div>
      </form>
      <ShopView title={q ? `“${q}”` : "BUSCAR"} eyebrow="Resultados" basePath="/search" searchParams={sp} />
    </>
  );
}
