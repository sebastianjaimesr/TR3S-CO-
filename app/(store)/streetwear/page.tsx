import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "STREETWEAR", description: "Sneakers y estilo urbano: la curaduría streetwear de TR3S & CO.", alternates: { canonical: "/streetwear" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="STREETWEAR" eyebrow="Urbano" intro="Calle, actitud y visaje. Sneakers y lifestyle para tu día a día." preset={{ category: ["sneakers", "lifestyle"] }} hide={[]} basePath="/streetwear" searchParams={await searchParams} />;
}
