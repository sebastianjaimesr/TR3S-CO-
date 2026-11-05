import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ArrowIcon } from "@/components/icons";
import { site } from "@/lib/site";
import { HeroShowcase } from "@/features/home/HeroShowcase";
import { HeroStage, type StageShoe } from "@/features/home/HeroStage";
import type { Product } from "@/types/domain";

const ring = "ESENCIA · ESTILO · VISAJE · TR3S & CO. · ";

/**
 * Brand-first hero. Realism before effects, in this order of preference:
 * 1. the three-sneaker stage, built from the owner's cut-out photos
 *    (/admin/home, shown once the central protagonist is uploaded);
 * 2. a REAL catalog product with its own studio photo;
 * 3. the official logo composition.
 * Never a generated or redrawn shoe. A hero photo uploaded in /admin/home
 * becomes the background.
 */
export function BrandHero({ photo, spotlight, stage = [] }: { photo?: { url: string; alt: string }; spotlight?: Product; stage?: StageShoe[] }) {
  const hasStage = stage.some((s) => s.slot === "hero-centro");
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

      <div className="mx-auto grid max-w-[1600px] items-center gap-6 px-4 pb-16 pt-10 md:px-8 lg:min-h-[calc(100svh-112px)] lg:grid-cols-12 lg:gap-10 lg:py-16">
        <div className={`relative z-10 ${hasStage ? "lg:col-span-5" : "lg:col-span-6 xl:col-span-7"}`}>
          <div>
            <p className="eyebrow hero-line mb-6 flex items-center gap-3">
              <span className="inline-block h-px w-10 bg-crimson" aria-hidden />
              Sneakers · Streetwear · Deportivo
            </p>
          </div>
          <h1 id="hero-title" className={`headline text-[17vw] text-paper sm:text-[12vw] ${hasStage ? "lg:text-[6.2vw] 2xl:text-[7.5rem]" : "lg:text-[7vw] 2xl:text-[8.5rem]"}`}>
            <span className="block"><span className="hero-line block" style={{ animationDelay: "0ms" }}>Tu estilo.</span></span>
            <span className="block"><span className="hero-line block text-outline" style={{ animationDelay: "120ms" }}>Tu esencia.</span></span>
            <span className="block"><span className="hero-line block text-crimson" style={{ animationDelay: "240ms" }}>Tu camino.</span></span>
          </h1>
          <div>
            <p className="hero-line mt-8 max-w-lg text-base leading-relaxed text-bone/75 md:text-lg" style={{ animationDelay: "380ms" }}>
              {site.concept}
            </p>
            <div className="hero-line mt-10 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "480ms" }}>
              <Link href="/shop" className="btn btn-primary group gap-3 px-8">
                Comprar ahora <ArrowIcon className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="#categorias" className="btn btn-ghost px-8">
                Descubrir colección
              </Link>
            </div>
          </div>
        </div>

        <div className={hasStage ? "order-first lg:order-none lg:col-span-7 lg:-mr-4 xl:-mr-8" : "lg:col-span-6 xl:col-span-5"}>
          {hasStage ? (
            <HeroStage shoes={stage} />
          ) : spotlight ? (
            <HeroShowcase product={spotlight} />
          ) : (
            <div aria-hidden className="relative mx-auto grid aspect-square w-full max-w-[min(86vw,520px)] place-items-center">
              <svg viewBox="0 0 400 400" className="spin-slow absolute inset-[6%] h-[88%] w-[88%] text-bone/40">
                <defs>
                  <path id="hero-ring" d="M200,200 m-170,0 a170,170 0 1,1 340,0 a170,170 0 1,1 -340,0" />
                </defs>
                <text className="font-display" fontSize="15" letterSpacing="6" fill="currentColor">
                  <textPath href="#hero-ring">{ring.repeat(2)}</textPath>
                </text>
              </svg>
              <div className="absolute inset-[22%] rounded-full border border-crimson/40" />
              <div className="absolute inset-[22%] rounded-full bg-crimson/10 blur-2xl" />
              <div className="relative shadow-[0_30px_80px_-20px_rgba(213,0,37,0.55)]">
                <Logo size={200} href={null} priority />
              </div>
            </div>
          )}
        </div>
      </div>

      <a href="#categorias" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-smoke hover:text-paper lg:flex">
        SCROLL
        <span className="h-10 w-px animate-pulse bg-bone/40" />
      </a>
    </section>
  );
}
