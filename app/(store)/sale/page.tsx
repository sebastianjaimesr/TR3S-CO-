import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "SALE", description: "Solo descuentos reales sobre el precio anterior publicado.", alternates: { canonical: "/sale" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="SALE" eyebrow="Descuentos reales" intro="Solo descuentos reales sobre el precio anterior publicado." preset={{ onSale: true }} hide={[]} basePath="/sale" searchParams={await searchParams} />;
}
