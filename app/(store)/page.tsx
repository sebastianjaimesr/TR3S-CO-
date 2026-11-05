import { Hero } from "@/features/home/Hero";
import { Experience } from "@/features/home/Experience";
import { BrandHero } from "@/features/home/BrandHero";
import { Manifesto } from "@/features/home/Manifesto";
import { Newsletter } from "@/features/newsletter/Newsletter";
import { BrandStory, BrandsStrip, CatalogPending, CategoryGrid, FutureCollections, Marquee, ProductRail, PromoBanner, TrustStrip } from "@/features/home/sections";
import { getAllProducts, getBestSellerIds, getBrands, getHeroData, getHomeMedia, getStoreSettings } from "@/services/catalog";
import { availableProviders } from "@/services/payments/providers";
import type { Product } from "@/types/domain";

export const revalidate = 60;

const RAIL = 4;

export default async function HomePage() {
  const [{ campaign, products }, all, brands, media, settings, bestIds] = await Promise.all([
    getHeroData(),
    getAllProducts(),
    getBrands(),
    getHomeMedia(),
    getStoreSettings(),
    getBestSellerIds(),
  ]);

  // Every rail only shows real catalog products; empty rails are not rendered.
  const ranked = all.filter((p) => p.featuredRank != null);
  const featured = (ranked.length ? ranked : all).slice(0, RAIL);
  const newest = all.filter((p) => p.isNew);
  const newArrivals = (newest.length ? newest : [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).slice(0, RAIL);
  const byId = new Map(all.map((p) => [p.id, p]));
  const bestSellers = bestIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p)).slice(0, RAIL);
  const offers = all.filter((p) => p.compareAtPrice != null && p.compareAtPrice > p.price).slice(0, RAIL);
  const men = all.filter((p) => p.gender === "men" || p.gender === "unisex").slice(0, RAIL);
  const women = all.filter((p) => p.gender === "women" || p.gender === "unisex").slice(0, RAIL);
  const payments = availableProviders(settings.paymentMethods).map((p) => p.label);
  const hasCatalog = all.length > 0;

  return (
    <>
      <BrandHero photo={media.hero} />
      <Marquee />
      <CategoryGrid media={media} />
      {products.length > 0 && <Hero campaign={campaign} products={products} />}
      {hasCatalog ? (
        <>
          <ProductRail id="new-title" eyebrow="Lo último" title="Nuevos lanzamientos" products={newArrivals} href="/new-arrivals" />
          <ProductRail id="featured-title" eyebrow="Selección TR3S" title="Sneakers destacados" products={featured} href="/sneakers" />
          {offers.length > 0 && <ProductRail id="offers-title" eyebrow="Precio real rebajado" title="Ofertas" products={offers} href="/sale" accent />}
        </>
      ) : (
        <CatalogPending />
      )}
      <PromoBanner photo={media.banner} />
      {men.length > 0 && <ProductRail id="men-title" eyebrow="Colección" title="Hombre" products={men} href="/men" />}
      {women.length > 0 && <ProductRail id="women-title" eyebrow="Colección" title="Mujer" products={women} href="/women" />}
      {bestSellers.length > 0 && <ProductRail id="best-title" eyebrow="Lo que más se mueve" title="Más vendidos" products={bestSellers} href="/shop" />}
      <Manifesto />
      <BrandStory photo={media.story} />
      {products.length > 0 && <Experience products={products} />}
      <FutureCollections />
      <BrandsStrip brands={brands} />
      <Newsletter />
      <TrustStrip payments={payments.length ? payments.join(", ") : "Pasarelas certificadas"} />
    </>
  );
}
