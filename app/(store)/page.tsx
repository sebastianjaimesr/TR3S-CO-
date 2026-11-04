import { Hero } from "@/features/home/Hero";
import { Experience } from "@/features/home/Experience";
import { BrandHero } from "@/features/home/BrandHero";
import { BrandStory, BrandsStrip, CategoryGrid, FutureCollections, Marquee, ProductRail, PromoBanner, TrustStrip } from "@/features/home/sections";
import { getAllProducts, getBrands, getHeroData, getHomeMedia, getStoreSettings } from "@/services/catalog";
import { availableProviders } from "@/services/payments/providers";

export const revalidate = 60;

export default async function HomePage() {
  const [{ campaign, products }, all, brands, media, settings] = await Promise.all([getHeroData(), getAllProducts(), getBrands(), getHomeMedia(), getStoreSettings()]);

  // Rails only ever show real catalog products (never placeholders).
  const ranked = all.filter((p) => p.featuredRank != null);
  const featured = (ranked.length ? ranked : all).slice(0, 4);
  const newest = all.filter((p) => p.isNew);
  const newArrivals = (newest.length ? newest : [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).slice(0, 4);
  const payments = availableProviders(settings.paymentMethods).map((p) => p.label);

  return (
    <>
      <BrandHero photo={media.hero} />
      <Marquee />
      <CategoryGrid media={media} />
      {products.length > 0 && <Hero campaign={campaign} products={products} />}
      <ProductRail id="featured-title" eyebrow="Selección TR3S" title="Destacados" products={featured} href="/shop" />
      <PromoBanner photo={media.banner} />
      <ProductRail id="new-title" eyebrow="Lo último" title="New arrivals" products={newArrivals} href="/new-arrivals" />
      <BrandStory photo={media.story} />
      <Experience products={products} />
      <FutureCollections />
      <BrandsStrip brands={brands} />
      <TrustStrip payments={payments.length ? payments.join(", ") : "Pasarelas certificadas"} />
    </>
  );
}
