import { describe, expect, it } from "vitest";
import { demoProducts } from "@/database/seed/demo-catalog";
import { catalogFacets, filterProducts, parseFilters } from "@/services/catalog-filter";
import { isPurchasable, productAvailability, statusFromQuantities, variantPrice } from "@/services/availability";
import { discountPercent, formatCOP, slugify } from "@/lib/format";

describe("availability", () => {
  it("own stock wins, then supplier, else sold out — never summed", () => {
    expect(statusFromQuantities(1, 0)).toBe("available_now");
    expect(statusFromQuantities(0, 3)).toBe("available_on_order");
    expect(statusFromQuantities(0, 0)).toBe("sold_out");
  });
  it("DEMO products are never purchasable", () => {
    for (const p of demoProducts) expect(isPurchasable(p, p.variants[0])).toBe(false);
  });
  it("variant price overrides product price", () => {
    expect(variantPrice({ price: 100 }, { price: null })).toBe(100);
    expect(variantPrice({ price: 100 }, { price: 90 })).toBe(90);
  });
  it("product availability is the best of its variants", () => {
    const p = demoProducts.find((x) => x.slug === "demo-runner-x-graphite")!;
    expect(productAvailability(p)).toBe("available_on_order");
  });
});

describe("catalog filters", () => {
  it("filters by gender including unisex", () => {
    const r = filterProducts(demoProducts, { gender: ["men"], pageSize: 100 });
    expect(r.items.every((p) => p.gender === "men" || p.gender === "unisex")).toBe(true);
    expect(r.items.some((p) => p.gender === "women")).toBe(false);
  });
  it("size filter ignores sold-out variants", () => {
    const r = filterProducts(demoProducts, { size: ["44"], pageSize: 100 });
    for (const p of r.items) expect(p.variants.some((v) => v.size === "44" && v.availability.status !== "sold_out")).toBe(true);
  });
  it("search is accent-insensitive and matches brand, name and SKU", () => {
    expect(filterProducts(demoProducts, { q: "carmesi" }).total).toBe(1);
    expect(filterProducts(demoProducts, { q: "demo athletics runner" }).total).toBe(2);
  });
  it("sale only returns real discounts", () => {
    const r = filterProducts(demoProducts, { onSale: true, pageSize: 100 });
    expect(r.total).toBeGreaterThan(0);
    for (const p of r.items) expect(p.compareAtPrice! > p.price).toBe(true);
  });
  it("sorts and paginates", () => {
    const asc = filterProducts(demoProducts, { sort: "price_asc", pageSize: 100 }).items.map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const p2 = filterProducts(demoProducts, { pageSize: 4, page: 2 });
    expect(p2.items).toHaveLength(4);
    expect(p2.pageCount).toBe(3);
  });
  it("parses URL params defensively", () => {
    const f = parseFilters({ brand: "a,b", min: "-5", max: "abc", sort: "drop table", page: "2" });
    expect(f.brand).toEqual(["a", "b"]);
    expect(f.minPrice).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
    expect(f.sort).toBeUndefined();
    expect(f.page).toBe(2);
  });
  it("facets include every size and brand", () => {
    const f = catalogFacets(demoProducts);
    expect(f.brands.length).toBe(3);
    expect(f.sizes[0]).toBe("35");
  });
});

describe("formatting", () => {
  it("formats COP without decimals", () => {
    expect(formatCOP(389000)).toBe("$ 389.000");
  });
  it("discount only when real", () => {
    expect(discountPercent(459000, 529000)).toBe(13);
    expect(discountPercent(459000, 459000)).toBeNull();
    expect(discountPercent(459000, null)).toBeNull();
  });
  it("slugifies Spanish text", () => {
    expect(slugify("Bota Montaña Niño 42")).toBe("bota-montana-nino-42");
  });
});
