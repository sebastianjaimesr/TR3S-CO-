import Link from "next/link";
import { Suspense } from "react";
import type { CatalogFilters } from "@/types/domain";
import { parseFilters } from "@/services/catalog-filter";
import { searchProducts } from "@/services/catalog";
import { ProductCard } from "@/features/catalog/ProductCard";
import { Filters } from "@/features/catalog/Filters";

type SP = Record<string, string | string[] | undefined>;

/** Shared catalog page: preset filters (e.g. gender=men) merged with URL filters. */
export async function ShopView({
  title,
  eyebrow,
  intro,
  preset = {},
  searchParams,
  basePath,
  hide,
}: {
  title: string;
  eyebrow?: string;
  intro?: string;
  preset?: Partial<CatalogFilters>;
  searchParams: SP;
  basePath: string;
  hide?: string[];
}) {
  const urlFilters = parseFilters(searchParams);
  const clean = Object.fromEntries(
    Object.entries(urlFilters).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as CatalogFilters;
  const filters: CatalogFilters = { ...preset, ...clean };
  if (preset.gender) filters.gender = preset.gender;
  if (preset.brand) filters.brand = preset.brand;
  if (preset.onSale) filters.onSale = true;
  if (preset.isNew) filters.isNew = true;
  if (preset.category) {
    const narrowed = urlFilters.category?.filter((c) => preset.category!.includes(c));
    filters.category = narrowed?.length ? narrowed : preset.category;
  }
  const { items, total, page, pageCount, facets } = await searchProducts(filters);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => v != null && k !== "page" && sp.set(k, Array.isArray(v) ? v.join(",") : v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <header className="mb-10 border-b border-line pb-8">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display text-5xl font-bold tracking-tight md:text-7xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-bone/70">{intro}</p>}
        <p className="mt-4 text-xs text-smoke" aria-live="polite">{total} {total === 1 ? "producto" : "productos"}</p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filtros">
          <Suspense>
            <Filters facets={facets} hide={hide} />
          </Suspense>
        </aside>
        <section aria-label="Resultados">
          {items.length === 0 ? (
            <div className="border border-line p-12 text-center">
              <p className="font-display text-2xl">No encontramos productos con esos filtros.</p>
              <Link href={basePath} className="btn btn-ghost mt-6">Quitar filtros</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 3} />
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={pageHref(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`grid h-10 w-10 place-items-center border text-sm ${p === page ? "border-paper bg-paper text-ink" : "border-line hover:border-paper"}`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
