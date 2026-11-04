"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn, formatCOP } from "@/lib/format";
import { CloseIcon } from "@/components/icons";

export interface Facets {
  brands: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  sizes: string[];
  colors: string[];
  shoeTypes: string[];
  priceRange: { min: number; max: number };
}

const genders = [
  { v: "men", l: "Hombre" },
  { v: "women", l: "Mujer" },
];
const availability = [
  { v: "available_now", l: "Disponible ya" },
  { v: "available_on_order", l: "Bajo pedido" },
];
const sorts = [
  { v: "featured", l: "Destacados" },
  { v: "newest", l: "Más nuevos" },
  { v: "price_asc", l: "Precio: menor a mayor" },
  { v: "price_desc", l: "Precio: mayor a menor" },
  { v: "name", l: "Nombre" },
];

/** Filters live in the URL so results are shareable, indexable and back-button friendly. */
export function Filters({ facets, hide = [] }: { facets: Facets; hide?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const values = (k: string) => (sp.get(k)?.split(",").filter(Boolean) ?? []);
  const push = (next: URLSearchParams) => {
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const toggle = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    const cur = values(k);
    const upd = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (upd.length) next.set(k, upd.join(","));
    else next.delete(k);
    push(next);
  };
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    push(next);
  };
  const activeCount = ["brand", "category", "gender", "size", "color", "type", "availability", "min", "max"].reduce(
    (a, k) => a + values(k).length,
    0,
  );

  const panel = (
    <div className={cn("space-y-8", pending && "opacity-60")}>
      {!hide.includes("brand") && facets.brands.length > 0 && (
        <Group title="Marca">
          {facets.brands.map((b) => (
            <Check key={b.slug} label={b.name} checked={values("brand").includes(b.slug)} onChange={() => toggle("brand", b.slug)} />
          ))}
        </Group>
      )}
      {!hide.includes("category") && (
        <Group title="Categoría">
          {facets.categories.map((c) => (
            <Check key={c.slug} label={c.name} checked={values("category").includes(c.slug)} onChange={() => toggle("category", c.slug)} />
          ))}
        </Group>
      )}
      {!hide.includes("gender") && (
        <Group title="Género">
          {genders.map((g) => (
            <Check key={g.v} label={g.l} checked={values("gender").includes(g.v)} onChange={() => toggle("gender", g.v)} />
          ))}
        </Group>
      )}
      <Group title="Talla (EU)">
        <div className="grid grid-cols-5 gap-1.5">
          {facets.sizes.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={values("size").includes(s)}
              onClick={() => toggle("size", s)}
              className={cn("h-9 border text-xs", values("size").includes(s) ? "border-paper bg-paper text-ink" : "border-line text-bone hover:border-paper")}
            >
              {s}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Color">
        {facets.colors.map((c) => (
          <Check key={c} label={c} checked={values("color").includes(c)} onChange={() => toggle("color", c)} />
        ))}
      </Group>
      <Group title="Tipo de calzado">
        {facets.shoeTypes.map((t) => (
          <Check key={t} label={t} checked={values("type").includes(t)} onChange={() => toggle("type", t)} />
        ))}
      </Group>
      <Group title="Disponibilidad">
        {availability.map((a) => (
          <Check key={a.v} label={a.l} checked={values("availability").includes(a.v)} onChange={() => toggle("availability", a.v)} />
        ))}
      </Group>
      <Group title="Precio (COP)">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const next = new URLSearchParams(sp.toString());
            ["min", "max"].forEach((k) => {
              const v = String(f.get(k) ?? "").replace(/\D/g, "");
              if (v) next.set(k, v);
              else next.delete(k);
            });
            push(next);
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Mínimo</span>
            <input name="min" inputMode="numeric" defaultValue={sp.get("min") ?? ""} placeholder={formatCOP(facets.priceRange.min)} className="field h-10 min-h-0 text-xs" />
          </label>
          <label className="flex-1">
            <span className="sr-only">Máximo</span>
            <input name="max" inputMode="numeric" defaultValue={sp.get("max") ?? ""} placeholder={formatCOP(facets.priceRange.max)} className="field h-10 min-h-0 text-xs" />
          </label>
          <button type="submit" className="btn btn-ghost h-10 min-h-0 px-3">OK</button>
        </form>
      </Group>
      {activeCount > 0 && (
        <button type="button" onClick={() => push(new URLSearchParams(sp.get("q") ? { q: sp.get("q")! } : {}))} className="text-xs text-smoke underline">
          Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost h-10 min-h-0">
          Filtros{activeCount ? ` (${activeCount})` : ""}
        </button>
        <SortSelect value={sp.get("sort") ?? "featured"} onChange={(v) => setParam("sort", v)} />
      </div>
      <div className="hidden lg:block">
        <div className="mb-8"><SortSelect value={sp.get("sort") ?? "featured"} onChange={(v) => setParam("sort", v)} /></div>
        {panel}
      </div>
      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink p-5 lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Filtros</h2>
            <button type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center" aria-label="Cerrar filtros"><CloseIcon /></button>
          </div>
          {panel}
          <button type="button" onClick={() => setOpen(false)} className="btn btn-primary sticky bottom-0 mt-8 w-full">Ver resultados</button>
        </div>
      )}
    </>
  );
}

function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-smoke">
      <span>Ordenar</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-10 min-h-0 w-auto py-0 text-xs">
        {sorts.map((s) => (
          <option key={s.v} value={s.v}>{s.l}</option>
        ))}
      </select>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-bone/80 hover:text-paper">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#a52632]" />
      <span className="capitalize">{label}</span>
    </label>
  );
}
