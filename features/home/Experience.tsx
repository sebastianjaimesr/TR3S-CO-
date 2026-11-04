"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types/domain";
import { AvailabilityBadge, Price } from "@/features/catalog/bits";
import { productAvailability, shortestLeadTime } from "@/services/availability";
import { hasWebGL, isLowPowerDevice } from "@/features/three/webgl";

const BoutiqueScene = dynamic(() => import("@/features/three/BoutiqueScene"), { ssr: false });

/** Mounted only when scrolled into view, so it never delays the storefront. */
export function Experience({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [env, setEnv] = useState<{ ok: boolean; low: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(products[0]?.id ?? null);
  const items = products.slice(0, 5);
  const current = items.find((p) => p.id === selected) ?? items[0];

  useEffect(() => {
    setEnv({ ok: hasWebGL(), low: isLowPowerDevice() });
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && (setVisible(true), io.disconnect()), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!items.length) return null;

  return (
    <section aria-labelledby="exp-title" className="border-t border-line bg-ink py-20">
      <div className="mx-auto max-w-[1600px] px-4 md:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-3">Boutique virtual</p>
            <h2 id="exp-title" className="font-display text-4xl font-bold tracking-tight md:text-6xl">THE TR3S EXPERIENCE</h2>
          </div>
          <p className="max-w-md text-sm text-bone/70">Recorre la vitrina, toca un exhibidor y mira los detalles. Si prefieres ir directo, todo está en la tienda.</p>
        </div>
        <div ref={ref} className="relative grid gap-4 lg:grid-cols-12">
          <div className="relative aspect-[4/5] overflow-hidden border border-line bg-coal sm:aspect-[16/10] lg:col-span-9 lg:aspect-[16/8]">
            {visible && env?.ok ? (
              <BoutiqueScene
                items={items.map((p) => ({ id: p.id, name: p.name, modelUrl: p.modelUrl, colorway: p.conceptColorway }))}
                selected={selected}
                onSelect={setSelected}
                lowPower={env.low}
              />
            ) : (
              <div className="grid h-full grid-cols-2 gap-px bg-line sm:grid-cols-3">
                {items.map((p) => (
                  <button key={p.id} type="button" onClick={() => setSelected(p.id)} className="relative bg-coal" aria-label={`Ver ${p.name}`}>
                    {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="33vw" className="object-contain p-6" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {current && (
            <aside className="border border-line bg-coal p-6 lg:col-span-3" aria-live="polite">
              <p className="eyebrow">{current.brand.name}</p>
              <h3 className="mt-2 font-display text-2xl font-semibold">{current.name}</h3>
              <p className="mt-4 font-display text-xl"><Price price={current.price} compareAt={current.compareAtPrice} /></p>
              <AvailabilityBadge className="mt-3" status={productAvailability(current)} leadTimeDays={shortestLeadTime(current)} />
              {current.isDemo && <p className="mt-4 text-xs text-crimson">Producto DEMO · no disponible para compra.</p>}
              <Link href={`/product/${current.slug}`} className="btn btn-primary mt-6 w-full">View product</Link>
              <div className="mt-6 flex flex-wrap gap-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={p.id === current.id}
                    onClick={() => setSelected(p.id)}
                    className={`border px-2 py-1 text-[11px] ${p.id === current.id ? "border-paper text-paper" : "border-line text-smoke"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
