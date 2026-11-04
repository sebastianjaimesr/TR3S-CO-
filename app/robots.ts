import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/cart", "/account", "/wishlist", "/login", "/dev-render"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
