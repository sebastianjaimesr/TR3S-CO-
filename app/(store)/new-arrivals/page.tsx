import type { Metadata } from "next";
import { ShopView } from "@/features/catalog/ShopView";

export const metadata: Metadata = { title: "NEW ARRIVALS", description: "Las referencias que acaban de llegar al catálogo.", alternates: { canonical: "/new-arrivals" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopView title="NEW ARRIVALS" eyebrow="Lo último" intro="Las referencias que acaban de llegar al catálogo." preset={{ isNew: true, sort: "newest" }} hide={[]} basePath="/new-arrivals" searchParams={await searchParams} />;
}
