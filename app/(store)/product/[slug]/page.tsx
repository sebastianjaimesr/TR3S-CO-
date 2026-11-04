import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, getStoreSettings } from "@/services/catalog";
import { Gallery } from "@/features/catalog/Gallery";
import { PurchasePanel } from "@/features/catalog/PurchasePanel";
import { ProductCard } from "@/features/catalog/ProductCard";
import { productAvailability } from "@/services/availability";
import { publicEnv } from "@/lib/env";
import { formatCOP } from "@/lib/format";
import { site } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ size?: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado" };
  const title = `${p.brand.name} ${p.name}`;
  const description = `${p.description.slice(0, 140)} · ${formatCOP(p.price)} · ${site.name}, Bucaramanga.`;
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    robots: p.isDemo ? { index: false, follow: true } : undefined,
    openGraph: { title, description, images: p.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

// Approximate foot length per EU size. Each brand fits differently.
const sizeGuide = [
  ["35", "22.5"], ["36", "23"], ["37", "23.5"], ["38", "24"], ["39", "25"],
  ["40", "25.5"], ["41", "26"], ["42", "26.5"], ["43", "27.5"], ["44", "28"],
];

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { size } = await searchParams;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(product), getStoreSettings()]);

  const status = productAvailability(product);
  const jsonLd = product.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        sku: product.reference,
        brand: { "@type": "Brand", name: product.brand.name },
        description: product.description,
        image: product.images.map((i) => new URL(i.url, publicEnv.siteUrl).toString()),
        offers: {
          "@type": "Offer",
          priceCurrency: "COP",
          price: product.price,
          url: `${publicEnv.siteUrl}/product/${product.slug}`,
          availability:
            status === "available_now"
              ? "https://schema.org/InStock"
              : status === "available_on_order"
                ? "https://schema.org/PreOrder"
                : "https://schema.org/OutOfStock",
          seller: { "@type": "Organization", name: site.name },
        },
      };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8 md:py-12">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <nav aria-label="Ruta" className="mb-6 text-xs text-smoke">
        <Link href="/shop" className="hover:text-paper">Shop</Link> / <Link href={`/brands/${product.brand.slug}`} className="hover:text-paper">{product.brand.name}</Link> /{" "}
        <span className="text-bone">{product.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Gallery product={product} />
        </div>
        <div className="lg:col-span-5">
          <PurchasePanel product={product} whatsappNumber={settings.whatsappNumber} initialSize={size} />
          <div className="mt-12 divide-y divide-line border-y border-line">
            <Info title="Descripción" open>
              <p>{product.description}</p>
              <p className="mt-2 text-smoke">Categoría: {product.category.name} · Tipo: {product.shoeType} · Género: {product.gender === "men" ? "Hombre" : product.gender === "women" ? "Mujer" : "Unisex"}</p>
            </Info>
            <Info title="Materiales">
              <p>{product.materials ?? "El proveedor no ha reportado materiales para esta referencia. Pregúntanos por WhatsApp."}</p>
            </Info>
            <Info title="Guía de tallas" id="guia-tallas">
              <p className="mb-3">Equivalencias de referencia. Cada marca horma distinto: si estás entre dos tallas, escríbenos antes de comprar.</p>
              <table className="w-full text-left text-xs">
                <thead className="text-smoke">
                  <tr><th className="py-1">Talla EU</th><th>Largo del pie (cm, aprox.)</th></tr>
                </thead>
                <tbody>
                  {sizeGuide.map((r) => (
                    <tr key={r[0]} className="border-t border-line"><td className="py-1.5">{r[0]}</td><td>{r[1]}</td></tr>
                  ))}
                </tbody>
              </table>
            </Info>
            <Info title="Envíos">
              <p>
                Envío a toda Colombia. Tarifa: {settings.shippingFlatRate === 0 ? "gratis" : formatCOP(settings.shippingFlatRate)}
                {settings.freeShippingFrom ? `, gratis desde ${formatCOP(settings.freeShippingFrom)}` : ""}. Inventario propio: despacho en 24–48 h hábiles.
                Bajo pedido: el plazo indicado empieza cuando el proveedor confirma la disponibilidad.
              </p>
              <Link href="/policies/envios" className="mt-2 inline-block underline">Política de envíos</Link>
            </Info>
            <Info title="Cambios">
              <p>Cambios de talla sujetos a disponibilidad, con el producto sin uso y en su caja original. Derecho de retracto según la Ley 1480 de 2011.</p>
              <Link href="/policies/cambios-y-devoluciones" className="mt-2 inline-block underline">Política de cambios</Link>
            </Info>
            <Info title="Garantías">
              <p>Garantía legal por defectos de fabricación, gestionada con la marca o el proveedor correspondiente.</p>
              <Link href="/policies/garantias" className="mt-2 inline-block underline">Política de garantías</Link>
            </Info>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-20 border-t border-line pt-12">
          <h2 id="related" className="font-display text-3xl font-bold tracking-tight">TAMBIÉN TE PUEDE GUSTAR</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ title, children, open, id }: { title: string; children: React.ReactNode; open?: boolean; id?: string }) {
  return (
    <details open={open} id={id} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-sm font-semibold tracking-[0.15em]">
        {title.toUpperCase()}
        <span aria-hidden className="text-smoke transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-bone/75">{children}</div>
    </details>
  );
}
