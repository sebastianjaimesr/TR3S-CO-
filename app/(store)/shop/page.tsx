import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "SHOP", description: "Sneakers, running, casual y formal de diferentes marcas, para hombre y mujer.", alternates: { canonical: "/shop" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="SHOP" eyebrow="Catálogo completo" intro="Sneakers, running, casual y formal de diferentes marcas, para hombre y mujer." preset={{}} hide={[]} basePath="/shop" searchParams={await searchParams} />;
}
