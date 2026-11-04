import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/features/catalog/ShopView";
import { getBrands } from "@/services/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = (await getBrands()).find((b) => b.slug === slug);
  return brand ? { title: brand.name, description: brand.description ?? undefined, alternates: { canonical: `/brands/${slug}` } } : {};
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = (await getBrands()).find((b) => b.slug === slug);
  if (!brand) notFound();
  return (
    <ShopView
      title={brand.name.toUpperCase()}
      eyebrow="Marca"
      intro={brand.description ?? undefined}
      preset={{ brand: [brand.slug] }}
      hide={["brand"]}
      basePath={`/brands/${slug}`}
      searchParams={await searchParams}
    />
  );
}
