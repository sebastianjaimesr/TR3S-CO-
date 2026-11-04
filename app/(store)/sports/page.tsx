import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "SPORTS", description: "Running y training para moverte con respaldo.", alternates: { canonical: "/sports" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="SPORTS" eyebrow="Rendimiento" intro="Running y training para moverte con respaldo." preset={{ category: ["running", "training"] }} hide={[]} basePath="/sports" searchParams={await searchParams} />;
}
