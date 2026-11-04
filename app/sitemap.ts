import type { MetadataRoute } from "next";
import { getAllProducts, getBrands } from "@/services/catalog";
import { publicEnv } from "@/lib/env";
import { policies } from "@/lib/policies";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const [products, brands] = await Promise.all([getAllProducts(), getBrands()]);
  const now = new Date();
  const statics = ["", "/shop", "/men", "/women", "/sneakers", "/sports", "/brands", "/new-arrivals", "/sale", "/about", "/contact", "/faq", "/orders/track"];
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 })),
    ...Object.keys(policies).map((s) => ({ url: `${base}/policies/${s}`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
    ...brands.filter((b) => !b.isDemo).map((b) => ({ url: `${base}/brands/${b.slug}`, lastModified: now, priority: 0.6 })),
    // DEMO products are excluded from indexing
    ...products.filter((p) => !p.isDemo).map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: new Date(p.createdAt), priority: 0.8 })),
  ];
}
