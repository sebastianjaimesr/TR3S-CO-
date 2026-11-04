import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Brand, CatalogFilters, Category, HeroCampaign, Product, StoreSettings } from "@/types/domain";
import { supabasePublic } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { demoBrands, demoCampaign, demoProducts, demoSettings, categories as demoCategories } from "@/database/seed/demo-catalog";
import { catalogFacets, filterProducts } from "@/services/catalog-filter";
import type { AvailabilityStatus } from "@/types/domain";

export const CATALOG_TAG = "catalog";

/** True when the storefront is running on the DEMO catalog (no database configured). */
export function isDemoMode() {
  return !isSupabaseConfigured();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapBrand(b: any): Brand {
  return { id: b.id, slug: b.slug, name: b.name, description: b.description, logoUrl: b.logo_url, isActive: b.is_active, isDemo: b.is_demo };
}

function mapProduct(row: any, avail: Map<string, any>): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    reference: row.reference,
    brand: mapBrand(row.brand),
    category: { id: row.category.id, slug: row.category.slug, name: row.category.name },
    gender: row.gender,
    shoeType: row.shoe_type,
    description: row.description,
    materials: row.materials,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    isNew: row.is_new,
    isActive: row.is_active,
    isDemo: row.is_demo,
    modelUrl: row.model_url,
    conceptColorway: row.concept_colorway,
    createdAt: row.created_at,
    images: (row.images ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((i: any) => ({ url: i.url, alt: i.alt || row.name, position: i.position })),
    variants: (row.variants ?? [])
      .filter((v: any) => v.is_active)
      .sort((a: any, b: any) => parseFloat(a.size) - parseFloat(b.size))
      .map((v: any) => {
        const a = avail.get(v.id);
        return {
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.color_hex,
          price: v.price,
          availability: {
            status: (a?.status ?? "sold_out") as AvailabilityStatus,
            ownQuantity: a?.own_available ?? 0,
            supplierQuantity: a?.supplier_available ?? 0,
            leadTimeDays: a?.lead_time_days ?? null,
            supplierConfirmedAt: a?.supplier_confirmed_at ?? null,
          },
        };
      }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PRODUCT_SELECT =
  "id, slug, name, reference, gender, shoe_type, description, materials, price, compare_at_price, is_new, is_active, is_demo, model_url, concept_colorway, featured_rank, created_at," +
  " brand:brands!inner(id, slug, name, description, logo_url, is_active, is_demo)," +
  " category:categories!inner(id, slug, name)," +
  " images:product_images(url, alt, position)," +
  " variants:product_variants(id, sku, size, color, color_hex, price, is_active)";

const fetchAllProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const sb = supabasePublic();
    if (!sb) return demoProducts;
    const { data, error } = await sb
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(`catalog: ${error.message}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as unknown as any[];
    const variantIds = rows.flatMap((p: { variants: { id: string }[] }) => p.variants.map((v) => v.id));
    const avail = new Map<string, unknown>();
    for (let i = 0; i < variantIds.length; i += 300) {
      const { data: a, error: e2 } = await sb
        .from("variant_availability")
        .select("*")
        .in("variant_id", variantIds.slice(i, i + 300));
      if (e2) throw new Error(`availability: ${e2.message}`);
      a?.forEach((r: { variant_id: string }) => avail.set(r.variant_id, r));
    }
    return rows.map((row) => mapProduct(row, avail as Map<string, never>));
  },
  ["all-products"],
  { revalidate: 60, tags: [CATALOG_TAG] },
);

export const getAllProducts = cache(fetchAllProducts);

export async function searchProducts(filters: CatalogFilters) {
  const all = await getAllProducts();
  return { ...filterProducts(all, filters), facets: catalogFacets(all) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const all = await getAllProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const all = await getAllProducts();
  return all
    .filter((p) => p.id !== product.id)
    .map((p) => ({ p, score: (p.category.id === product.category.id ? 2 : 0) + (p.brand.id === product.brand.id ? 1 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export const getBrands = unstable_cache(
  async (): Promise<Brand[]> => {
    const sb = supabasePublic();
    if (!sb) return demoBrands;
    const { data, error } = await sb.from("brands").select("*").eq("is_active", true).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapBrand);
  },
  ["brands"],
  { revalidate: 300, tags: [CATALOG_TAG] },
);

export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const sb = supabasePublic();
    if (!sb) return demoCategories;
    const { data, error } = await sb.from("categories").select("id, slug, name").order("position");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["categories"],
  { revalidate: 300, tags: [CATALOG_TAG] },
);

export const getStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    const sb = supabasePublic();
    const fallback = { ...demoSettings, whatsappNumber: publicEnv.whatsappNumber || null };
    if (!sb) return fallback;
    const { data, error } = await sb.from("store_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return fallback;
    return {
      whatsappNumber: data.whatsapp_number || publicEnv.whatsappNumber || null,
      shippingFlatRate: data.shipping_flat_rate,
      freeShippingFrom: data.free_shipping_from,
      bankTransferInstructions: data.bank_transfer_instructions,
      paymentMethods: { wompi: data.payment_wompi_enabled, transfer: data.payment_transfer_enabled },
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      address: data.address,
      instagramUrl: data.instagram_url,
      tiktokUrl: data.tiktok_url,
    };
  },
  ["store-settings"],
  { revalidate: 60, tags: [CATALOG_TAG] },
);

export interface HeroData {
  campaign: HeroCampaign;
  products: Product[];
}

/** Hero + carousel products, driven by the active homepage campaign. */
export async function getHeroData(): Promise<HeroData> {
  const all = await getAllProducts();
  const sb = supabasePublic();
  let campaign: HeroCampaign = demoCampaign;
  let ids: string[] | null = null;
  if (sb) {
    const now = new Date().toISOString();
    const { data } = await sb
      .from("homepage_campaigns")
      .select("*")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      campaign = {
        headline: data.headline,
        subheadline: data.subheadline,
        monumentalWords: data.monumental_words,
        productSlugs: [],
        fallbackImageUrl: data.fallback_image_url,
      };
      ids = data.product_ids;
    } else {
      campaign = { ...demoCampaign, productSlugs: [] };
    }
  }
  let products: Product[];
  if (ids && ids.length) {
    products = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Product => Boolean(p));
  } else if (campaign.productSlugs.length) {
    products = campaign.productSlugs.map((s) => all.find((p) => p.slug === s)).filter((p): p is Product => Boolean(p));
  } else {
    products = all.slice(0, 8);
  }
  return { campaign, products };
}
