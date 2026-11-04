import Link from "next/link";
import Image from "next/image";
import { Hero } from "@/features/home/Hero";
import { Storytelling } from "@/features/home/Storytelling";
import { Experience } from "@/features/home/Experience";
import { ProductCard } from "@/features/catalog/ProductCard";
import { Reveal } from "@/components/Reveal";
import { getAllProducts, getBrands, getHeroData } from "@/services/catalog";
import { ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";

export const revalidate = 60;

const collections = [
  { title: "MEN", href: "/men", copy: "Sneakers, running, casual y formal." },
  { title: "WOMEN", href: "/women", copy: "Lifestyle, plataformas y clásicos." },
  { title: "SNEAKERS", href: "/sneakers", copy: "La curaduría urbana de TR3S." },
  { title: "SPORTS", href: "/sports", copy: "Running y training para moverte." },
];

export default async function HomePage() {
  const [{ campaign, products }, all, brands] = await Promise.all([getHeroData(), getAllProducts(), getBrands()]);
  const newArrivals = [...all].filter((p) => p.isNew).slice(0, 4);
  const fallbackNew = newArrivals.length ? newArrivals : all.slice(0, 4);

  return (
    <>
      <Hero campaign={campaign} products={products} />

      <section aria-labelledby="collections-title" className="border-t border-line py-20">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8">
          <Reveal>
            <p className="eyebrow mb-3">Colecciones</p>
            <h2 id="collections-title" className="font-display text-4xl font-bold tracking-tight md:text-6xl">FIND YOUR NEXT STEP.</h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c, i) => {
              const sample = all[(i * 2) % Math.max(1, all.length)];
              return (
                <Reveal key={c.href} delay={i * 0.08}>
                  <Link href={c.href} className="group relative block aspect-[4/5] overflow-hidden border border-line bg-coal">
                    {sample?.images[0] && (
                      <Image
                        src={sample.images[0].url}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-contain p-10 opacity-60 transition-all duration-700 group-hover:scale-105 group-hover:opacity-90"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                      <div>
                        <h3 className="font-display text-3xl font-bold">{c.title}</h3>
                        <p className="mt-1 text-sm text-bone/70">{c.copy}</p>
                      </div>
                      <ArrowIcon className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <Storytelling />

      <section aria-labelledby="new-title" className="border-t border-line py-20">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8">
          <div className="mb-10 flex items-end justify-between">
            <Reveal>
              <p className="eyebrow mb-3">Lo último</p>
              <h2 id="new-title" className="font-display text-4xl font-bold tracking-tight md:text-6xl">NEW ARRIVALS</h2>
            </Reveal>
            <Link href="/new-arrivals" className="btn btn-ghost hidden sm:inline-flex">Ver todo</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {fallbackNew.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <Experience products={products} />

      <section aria-labelledby="brands-title" className="border-t border-line py-20">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8">
          <p className="eyebrow mb-3">Multimarca</p>
          <h2 id="brands-title" className="font-display text-4xl font-bold tracking-tight md:text-5xl">BRANDS</h2>
          <ul className="mt-10 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            {brands.map((b) => (
              <li key={b.id} className="bg-ink">
                <Link href={`/brands/${b.slug}`} className="grid h-28 place-items-center px-4 text-center font-display text-sm tracking-[0.2em] text-bone/70 transition-colors hover:bg-coal hover:text-paper">
                  {b.name.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-smoke">
            {site.name} es una tienda multimarca independiente. Las marcas pertenecen a sus respectivos titulares; no somos distribuidores oficiales salvo que se indique.
          </p>
        </div>
      </section>

      <section aria-label="Compra con confianza" className="border-t border-line bg-coal">
        <div className="mx-auto grid max-w-[1600px] gap-px bg-line md:grid-cols-4">
          {[
            ["Envíos a toda Colombia", "Bucaramanga y área metropolitana con entrega más rápida.", "/policies/envios"],
            ["Disponibilidad real", "Inventario propio o bajo pedido, siempre indicado con su plazo.", "/faq"],
            ["Cambios de talla", "Proceso claro y por escrito, sin letra pequeña.", "/policies/cambios-y-devoluciones"],
            ["Pagos seguros", "Wompi y transferencia. Nunca guardamos datos de tarjetas.", "/faq"],
          ].map(([t, d, href]) => (
            <Link key={t} href={href} className="bg-coal p-8 transition-colors hover:bg-graphite">
              <h3 className="font-display text-sm font-semibold tracking-[0.15em]">{t.toUpperCase()}</h3>
              <p className="mt-2 text-sm text-smoke">{d}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
