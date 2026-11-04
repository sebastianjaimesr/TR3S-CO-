import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "WOMEN", description: "Calzado para mujer: lifestyle, plataformas, running y clásicos.", alternates: { canonical: "/women" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="WOMEN" eyebrow="Mujer" intro="Calzado para mujer: lifestyle, plataformas, running y clásicos." preset={{ gender: ["women"] }} hide={["gender"]} basePath="/women" searchParams={await searchParams} />;
}
