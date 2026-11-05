import Image from "next/image";
import Link from "next/link";
import type { Brand, Product } from "@/types/domain";
import type { HomeMedia, HomeMediaSlot } from "@/lib/home-media";
import { ProductCard } from "@/features/catalog/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Logo } from "@/components/Logo";
import { ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { cn } from "@/lib/format";

const container = "mx-auto max-w-[1600px] px-4 md:px-8";

function SectionTitle({ eyebrow, title, id, action }: { eyebrow: string; title: string; id: string; action?: React.ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <Reveal>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h2 id={id} className="headline text-5xl md:text-7xl">{title}</h2>
      </Reveal>
      {action}
    </div>
  );
}

/** Kinetic type strip between sections. Purely decorative. */
export function Marquee({ words = ["SNEAKERS", "STREETWEAR", "DEPORTIVO", "ESENCIA", "ESTILO", "VISAJE"] }: { words?: string[] }) {
  const row = [...words, ...words];
  return (
    <div aria-hidden className="overflow-hidden border-y border-line bg-crimson py-3 text-ink">
      <div className="marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={`${k}-${i}`} className="headline flex items-center px-6 text-2xl md:text-3xl">
                {w}
                <span className="ml-12 inline-block h-2 w-2 rotate-45 bg-ink" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const categories: { title: string; href: string; copy: string; slot: HomeMediaSlot }[] = [
  { title: "HOMBRE", href: "/men", copy: "Sneakers, running y casual.", slot: "cat-hombre" },
  { title: "MUJER", href: "/women", copy: "Lifestyle, plataformas y clásicos.", slot: "cat-mujer" },
  { title: "SNEAKERS", href: "/sneakers", copy: "Cultura sneaker, curada.", slot: "cat-sneakers" },
  { title: "DEPORTIVO", href: "/sports", copy: "Running y training.", slot: "cat-deportivo" },
  { title: "STREETWEAR", href: "/streetwear", copy: "Calle, actitud y visaje.", slot: "cat-streetwear" },
];

export function CategoryGrid({ media }: { media: HomeMedia }) {
  return (
    <section id="categorias" aria-labelledby="cat-title" className="scroll-mt-28 py-20 md:py-28">
      <div className={container}>
        <SectionTitle eyebrow="Categorías" title="Encuentra tu estilo" id="cat-title" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {categories.map((c, i) => {
            const photo = media[c.slot];
            return (
              <Reveal key={c.href} delay={i * 0.06} className={i < 2 ? "col-span-1 md:col-span-3" : i === 4 ? "col-span-2 md:col-span-2" : "col-span-1 md:col-span-2"}>
                <Link
                  href={c.href}
                  className={cn(
                    "group relative block overflow-hidden border border-line bg-coal transition-colors duration-500 hover:border-crimson",
                    i < 2 ? "aspect-[4/5] md:aspect-[16/10]" : i === 4 ? "aspect-[16/9] md:aspect-[4/5]" : "aspect-[4/5]",
                  )}
                >
                  {photo ? (
                    <Image src={photo.url} alt={photo.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div aria-hidden className="stripes absolute inset-0">
                      <span className="headline text-outline absolute -right-2 top-2 text-[22vw] leading-none opacity-60 transition-transform duration-700 group-hover:-translate-x-3 md:text-[9vw]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                  <span className="absolute left-0 top-0 h-1 w-0 bg-crimson transition-all duration-500 group-hover:w-full" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-6">
                    <div className="min-w-0">
                      <h3 className="headline text-[7.5vw] sm:text-3xl md:text-4xl xl:text-5xl">{c.title}</h3>
                      <p className="mt-1 hidden text-sm text-bone/70 sm:block">{c.copy}</p>
                    </div>
                    <span className="hidden h-10 w-10 shrink-0 place-items-center border border-paper/30 sm:grid transition-all group-hover:border-crimson group-hover:bg-crimson">
                      <ArrowIcon />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A product rail. It only ever renders real catalog products; the empty state says so honestly. */
export function ProductRail({ id, eyebrow, title, products, href, accent }: { id: string; eyebrow: string; title: string; products: Product[]; href: string; accent?: boolean }) {
  return (
    <section aria-labelledby={id} className={cn("border-t border-line py-20 md:py-28", accent && "bg-gradient-to-b from-wine/25 to-transparent")}>
      <div className={container}>
        <SectionTitle
          eyebrow={eyebrow}
          title={title}
          id={id}
          action={products.length ? <Link href={href} className="btn btn-ghost">Ver todo</Link> : undefined}
        />
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <CatalogComingSoon />
        )}
      </div>
    </section>
  );
}

export function CatalogComingSoon() {
  return (
    <div className="relative overflow-hidden border border-dashed border-line p-8 md:p-14">
      <div aria-hidden className="stripes absolute inset-0" />
      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="eyebrow mb-3 text-crimson">Catálogo oficial en preparación</p>
          <p className="headline text-3xl md:text-5xl">Muy pronto, los primeros pares.</p>
          <p className="mt-4 max-w-xl text-sm text-smoke">
            Estamos seleccionando cada referencia con fotos reales, tallas y precios confirmados. Aquí solo verás productos disponibles de verdad.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/contact" className="btn btn-ghost">Pregúntanos por un par</Link>
        </div>
      </div>
    </div>
  );
}

export function PromoBanner({ photo }: { photo?: { url: string; alt: string } }) {
  return (
    <section aria-labelledby="promo-title" className="grain relative isolate overflow-hidden border-t border-line bg-wine/30">
      {photo ? (
        <>
          <Image src={photo.url} alt={photo.alt} fill sizes="100vw" className="-z-10 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-ink/65" />
        </>
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_50%,rgba(213,0,37,0.45),transparent_60%)]" />
      )}
      <p aria-hidden className="headline text-outline pointer-events-none absolute -bottom-6 right-0 select-none whitespace-nowrap text-[26vw] leading-none opacity-40">TR3S</p>
      <div className={cn(container, "relative py-24 md:py-36")}>
        <Reveal>
          <p className="eyebrow mb-6">Colección TR3S</p>
          <h2 id="promo-title" className="headline max-w-5xl text-6xl md:text-8xl xl:text-9xl">
            El estilo no se explica. <span className="text-crimson">Se lleva.</span>
          </h2>
          <Link href="/shop" className="btn btn-primary group mt-10 gap-3 px-8">
            Descubrir colección <ArrowIcon className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function BrandStory({ photo }: { photo?: { url: string; alt: string } }) {
  return (
    <section aria-labelledby="story-title" className="border-t border-line py-20 md:py-28">
      <div className={cn(container, "grid gap-12 lg:grid-cols-12 lg:items-center")}>
        <Reveal className="lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden border border-line bg-coal">
            {photo ? (
              <Image src={photo.url} alt={photo.alt} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
            ) : (
              <div className="stripes grid h-full place-items-center">
                <div className="shadow-[0_30px_80px_-20px_rgba(213,0,37,0.5)]">
                  <Logo size={200} href={null} />
                </div>
              </div>
            )}
            <span aria-hidden className="absolute bottom-0 left-0 h-1 w-1/3 bg-crimson" />
          </div>
        </Reveal>
        <div className="lg:col-span-7">
          <Reveal>
            <p className="eyebrow mb-3">Quiénes somos</p>
            <h2 id="story-title" className="headline text-5xl md:text-7xl">{site.slogan}</h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/75">{site.concept}</p>
          </Reveal>
          <Link href="/about" className="link-underline mt-10 inline-flex items-center gap-2 pb-1 text-sm tracking-[0.15em]">
            CONOCE LA HISTORIA <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Reserved slots for upcoming drops. Clearly labelled as placeholders: no product, price or date is implied. */
export function FutureCollections() {
  const slots = ["Drop 01", "Drop 02", "Drop 03"];
  return (
    <section aria-labelledby="future-title" className="border-t border-line py-20 md:py-28">
      <div className={container}>
        <SectionTitle eyebrow="Lo que viene" title="Próximas colecciones" id="future-title" />
        <div className="grid gap-3 md:grid-cols-3">
          {slots.map((s, i) => (
            <Reveal key={s} delay={i * 0.08}>
              <div className="group relative flex aspect-[4/3] flex-col justify-between overflow-hidden border border-dashed border-line bg-coal/60 p-6 transition-colors hover:border-crimson/60">
                <div aria-hidden className="stripes absolute inset-0 opacity-60" />
                <p className="relative text-[10px] tracking-[0.3em] text-smoke">ESPACIO RESERVADO</p>
                <div className="relative">
                  <p className="headline text-outline text-6xl">{s}</p>
                  <p className="mt-2 text-sm text-smoke">Se anunciará en nuestras redes. Sin fecha confirmada.</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BrandsStrip({ brands }: { brands: Brand[] }) {
  return (
    <section aria-labelledby="brands-title" className="border-t border-line py-20 md:py-28">
      <div className={container}>
        <SectionTitle
          eyebrow="Multimarca"
          title="Marcas"
          id="brands-title"
          action={brands.length ? <Link href="/brands" className="btn btn-ghost">Todas las marcas</Link> : undefined}
        />
        {brands.length ? (
          <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            {brands.map((b) => (
              <li key={b.id} className="bg-ink">
                <Link href={`/brands/${b.slug}`} className="grid h-28 place-items-center px-4 text-center font-display text-sm tracking-[0.2em] text-bone/70 transition-colors hover:bg-coal hover:text-paper">
                  {b.name.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-line p-8 text-sm text-smoke">Las marcas aparecerán aquí a medida que publiquemos el catálogo.</p>
        )}
        <p className="mt-4 text-xs text-smoke">
          {site.name} es una tienda multimarca independiente. Las marcas y logotipos pertenecen a sus respectivos titulares; no somos distribuidores
          oficiales ni tenemos alianzas con ellas salvo que se indique expresamente.
        </p>
      </div>
    </section>
  );
}

export function TrustStrip({ payments }: { payments: string }) {
  const items: [string, string, string][] = [
    ["Envíos a toda Colombia", "Tarifa clara antes de pagar. Si tu zona requiere cotización, no se cobra hasta que la aceptes.", "/policies/envios"],
    ["Disponibilidad real", "Inventario propio o bajo pedido, siempre indicado con su plazo.", "/faq"],
    ["Cambios de talla", "Proceso claro y por escrito, sin letra pequeña.", "/policies/cambios-y-devoluciones"],
    ["Pagos seguros", `${payments}. Nunca guardamos datos de tarjetas.`, "/faq"],
  ];
  return (
    <section aria-label="Compra con confianza" className="border-t border-line bg-coal">
      <div className="mx-auto grid max-w-[1600px] gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([t, d, href]) => (
          <Link key={t} href={href} className="group bg-coal p-8 transition-colors hover:bg-graphite">
            <span aria-hidden className="mb-4 block h-0.5 w-8 bg-crimson transition-all group-hover:w-16" />
            <h3 className="font-display text-sm font-semibold tracking-[0.15em]">{t.toUpperCase()}</h3>
            <p className="mt-2 text-sm text-smoke">{d}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Shown once, instead of every rail, while the official catalog is empty. */
export function CatalogPending() {
  return (
    <section aria-labelledby="pending-title" className="border-t border-line py-20 md:py-28">
      <div className={container}>
        <SectionTitle eyebrow="Tienda" title="Lanzamientos" id="pending-title" />
        <CatalogComingSoon />
      </div>
    </section>
  );
}
