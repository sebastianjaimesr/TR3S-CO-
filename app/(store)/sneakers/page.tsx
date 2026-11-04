import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "SNEAKERS", description: "La curaduría de sneakers y lifestyle de TR3S & CO.", alternates: { canonical: "/sneakers" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="SNEAKERS" eyebrow="Urbano" intro="La curaduría de sneakers y lifestyle de TR3S & CO." preset={{ category: ["sneakers", "lifestyle", "casual"] }} hide={[]} basePath="/sneakers" searchParams={await searchParams} />;
}
