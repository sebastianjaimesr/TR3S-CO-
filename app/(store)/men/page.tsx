import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "MEN", description: "Calzado para hombre: sneakers, running, training, casual y formal.", alternates: { canonical: "/men" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="MEN" eyebrow="Hombre" intro="Calzado para hombre: sneakers, running, training, casual y formal." preset={{ gender: ["men"] }} hide={["gender"]} basePath="/men" searchParams={await searchParams} />;
}
