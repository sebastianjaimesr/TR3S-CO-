import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";

const ring = "ESENCIA · ESTILO · VISAJE · TR3S & CO. · ";

/**
 * Brand-first hero. It never shows a product or a price: with no photo uploaded
 * it is a typographic composition around the official logo; once the owner
 * uploads a hero photo in /admin/home it becomes the background.
 */
export function BrandHero({ photo }: { photo?: { url: string; alt: string } }) {
  return (
    <section aria-labelledby="hero-title" className="grain relative isolate overflow-hidden bg-ink">
      {photo ? (
        <>
          <Image src={photo.url} alt={photo.alt} fill priority sizes="100vw" className="-z-10 object-cover opacity-70" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/70 to-ink/10" />
        </>
      ) : (
        <div aria-hidden className="stripes absolute inset-0 -z-10" />
      )}
      <div aria-hidden className="pointer-events-none absolute -right-[10vmin] top-1/2 -z-10 h-[90vmin] w-[90vmin] -translate-y-1/2 rounded-full bg-crimson/20 blur-[140px]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-ink to-transparent" />

      <div className="mx-auto grid max-w-[1600px] items-center gap-10 px-4 pb-16 pt-12 md:px-8 lg:min-h-[calc(100svh-112px)] lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-7">
          <p className="eyebrow mb-6 flex items-center gap-3">
            <span className="inline-block h-px w-10 bg-crimson" aria-hidden />
            Sneakers · Streetwear · Deportivo
          </p>
          <h1 id="hero-title" className="headline text-[17vw] text-paper sm:text-[12vw] lg:text-[7.4vw] 2xl:text-[8.5rem]">
            <span className="hero-line block" style={{ animationDelay: "0ms" }}>Tu estilo.</span>
            <span className="hero-line block text-outline" style={{ animationDelay: "120ms" }}>Tu esencia.</span>
            <span className="hero-line block text-crimson" style={{ animationDelay: "240ms" }}>Tu camino.</span>
          </h1>
          <p className="hero-line mt-8 max-w-lg text-base leading-relaxed text-bone/75 md:text-lg" style={{ animationDelay: "380ms" }}>
            {site.concept}
          </p>
          <div className="hero-line mt-10 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "480ms" }}>
            <Link href="/shop" className="btn btn-primary group gap-3 px-8">
              Comprar ahora <ArrowIcon className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="#categorias" className="btn btn-ghost px-8">
              Descubrir
            </Link>
          </div>
        </div>

        {!photo && (
          <div aria-hidden className="relative mx-auto hidden aspect-square w-full max-w-[460px] place-items-center sm:grid lg:col-span-5">
            <svg viewBox="0 0 400 400" className="spin-slow absolute inset-0 h-full w-full text-bone/40">
              <defs>
                <path id="hero-ring" d="M200,200 m-170,0 a170,170 0 1,1 340,0 a170,170 0 1,1 -340,0" />
              </defs>
              <text className="font-display" fontSize="15" letterSpacing="6" fill="currentColor">
                <textPath href="#hero-ring">{ring.repeat(2)}</textPath>
              </text>
            </svg>
            <div className="absolute inset-[18%] rounded-full border border-crimson/40" />
            <div className="absolute inset-[18%] rounded-full bg-crimson/10 blur-2xl" />
            <div className="relative shadow-[0_30px_80px_-20px_rgba(208,20,44,0.55)]">
              <Logo size={220} href={null} priority />
            </div>
          </div>
        )}
      </div>

      <a href="#categorias" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-smoke hover:text-paper lg:flex">
        SCROLL
        <span className="h-10 w-px animate-pulse bg-bone/40" />
      </a>
    </section>
  );
}
