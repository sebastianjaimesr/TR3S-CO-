import type { CatalogFilters, Product } from "@/types/domain";
import { productAvailability } from "@/services/availability";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Pure filtering/sorting used by both the demo catalog and the Supabase catalog. */
export function filterProducts(products: Product[], f: CatalogFilters) {
  let list = products.filter((p) => p.isActive);

  if (f.q) {
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    list = list.filter((p) => {
      const hay = norm(
        [p.name, p.brand.name, p.reference, p.category.name, p.shoeType, p.variants.map((v) => `${v.sku} ${v.color}`).join(" ")].join(" "),
      );
      return terms.every((t) => hay.includes(t));
    });
  }
  if (f.brand?.length) list = list.filter((p) => f.brand!.includes(p.brand.slug));
  if (f.category?.length) list = list.filter((p) => f.category!.includes(p.category.slug));
  if (f.gender?.length) list = list.filter((p) => f.gender!.includes(p.gender) || p.gender === "unisex");
  if (f.shoeType?.length) list = list.filter((p) => f.shoeType!.includes(p.shoeType));
  if (f.size?.length)
    list = list.filter((p) => p.variants.some((v) => f.size!.includes(v.size) && v.availability.status !== "sold_out"));
  if (f.color?.length) list = list.filter((p) => p.variants.some((v) => f.color!.includes(v.color)));
  if (f.minPrice != null) list = list.filter((p) => p.price >= f.minPrice!);
  if (f.maxPrice != null) list = list.filter((p) => p.price <= f.maxPrice!);
  if (f.availability?.length) list = list.filter((p) => f.availability!.includes(productAvailability(p)));
  if (f.onSale) list = list.filter((p) => p.compareAtPrice != null && p.compareAtPrice > p.price);
  if (f.isNew) list = list.filter((p) => p.isNew);

  const sorted = [...list];
  switch (f.sort) {
    case "price_asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
      break;
    default:
      // featured: available first, keep catalog order otherwise
      sorted.sort((a, b) => Number(productAvailability(a) === "sold_out") - Number(productAvailability(b) === "sold_out"));
  }

  const pageSize = f.pageSize ?? 12;
  const page = Math.max(1, f.page ?? 1);
  const total = sorted.length;
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Facets for the filter sidebar, computed from the unfiltered list. */
export function catalogFacets(products: Product[]) {
  const brands = new Map<string, string>();
  const categories = new Map<string, string>();
  const sizes = new Set<string>();
  const colors = new Set<string>();
  const shoeTypes = new Set<string>();
  let min = Infinity;
  let max = 0;
  for (const p of products) {
    brands.set(p.brand.slug, p.brand.name);
    categories.set(p.category.slug, p.category.name);
    shoeTypes.add(p.shoeType);
    min = Math.min(min, p.price);
    max = Math.max(max, p.price);
    for (const v of p.variants) {
      sizes.add(v.size);
      colors.add(v.color);
    }
  }
  return {
    brands: [...brands].map(([slug, name]) => ({ slug, name })),
    categories: [...categories].map(([slug, name]) => ({ slug, name })),
    sizes: [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
    colors: [...colors].sort(),
    shoeTypes: [...shoeTypes].sort(),
    priceRange: products.length ? { min, max } : { min: 0, max: 0 },
  };
}

const list = (v: string | string[] | undefined) =>
  v == null ? undefined : (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
const num = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters {
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) as CatalogFilters["sort"];
  return {
    q: (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 100) || undefined,
    brand: list(sp.brand),
    category: list(sp.category),
    gender: list(sp.gender) as CatalogFilters["gender"],
    size: list(sp.size),
    color: list(sp.color),
    shoeType: list(sp.type),
    availability: list(sp.availability) as CatalogFilters["availability"],
    minPrice: num(sp.min),
    maxPrice: num(sp.max),
    sort: ["featured", "price_asc", "price_desc", "newest", "name"].includes(sort ?? "") ? sort : undefined,
    page: num(sp.page),
  };
}
