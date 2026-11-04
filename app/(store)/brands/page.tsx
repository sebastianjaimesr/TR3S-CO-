import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProducts, getBrands } from "@/services/catalog";

export const metadata: Metadata = {
  title: "Marcas",
  description: "Marcas de calzado disponibles en TR3S & CO., tienda multimarca independiente en Bucaramanga.",
  alternates: { canonical: "/brands" },
};
export const revalidate = 300;

export default async function BrandsPage() {
  const [brands, products] = await Promise.all([getBrands(), getAllProducts()]);
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-14 md:px-8">
      <p className="eyebrow mb-3">Multimarca</p>
      <h1 className="font-display text-5xl font-bold tracking-tight md:text-7xl">BRANDS</h1>
      <p className="mt-4 max-w-2xl text-bone/70">
        Comercializamos productos de diferentes marcas a través de inventario propio y proveedores. Somos una tienda independiente: no
        afirmamos ser distribuidores oficiales salvo que se indique expresamente.
      </p>
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => {
          const count = products.filter((p) => p.brand.id === b.id).length;
          return (
            <li key={b.id}>
              <Link href={`/brands/${b.slug}`} className="group flex h-40 items-center justify-between border border-line bg-coal p-8 transition-colors hover:border-paper/40">
                <div>
                  {b.logoUrl ? (
                    <Image src={b.logoUrl} alt={b.name} width={140} height={48} className="h-12 w-auto object-contain" />
                  ) : (
                    <p className="font-display text-2xl font-semibold tracking-tight">{b.name}</p>
                  )}
                  <p className="mt-2 text-xs text-smoke">{count} {count === 1 ? "producto" : "productos"}{b.isDemo ? " · DEMO" : ""}</p>
                </div>
                <span aria-hidden className="text-smoke transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
