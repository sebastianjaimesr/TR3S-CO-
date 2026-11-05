import Link from "next/link";
import { Logo } from "@/components/Logo";
import { policyPages, site } from "@/lib/site";
import type { StoreSettings } from "@/types/domain";

export function Footer({ settings }: { settings: StoreSettings }) {
  const year = new Date().getFullYear();
  const socials = [
    settings.instagramUrl && { label: "IG", href: settings.instagramUrl },
    settings.tiktokUrl && { label: "TT", href: settings.tiktokUrl },
    settings.whatsappNumber && { label: "WA", href: `https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}` },
  ].filter((x): x is { label: string; href: string } => Boolean(x));
  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink">
      <p aria-hidden className="headline text-outline pointer-events-none absolute -bottom-[4vw] left-0 select-none whitespace-nowrap text-[22vw] leading-none opacity-30">TR3S &amp; CO.</p>
      <div className="relative mx-auto grid max-w-[1600px] gap-12 px-4 py-16 md:grid-cols-12 md:px-8 md:py-20">
        <div className="md:col-span-4">
          <Logo size={120} />
          <p className="mt-6 font-display text-sm tracking-[0.3em] text-paper">{site.slogan}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-smoke">{settings.storeDescription || site.concept}</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-smoke/80">
            Tienda multimarca independiente en {site.city}. No somos fabricantes ni distribuidores oficiales de las marcas que comercializamos.
          </p>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="Redes sociales">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="grid h-10 min-w-10 place-items-center border border-line px-3 text-xs tracking-[0.15em] text-bone/70 transition-colors hover:border-crimson hover:text-paper">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FooterCol
          title="Tienda"
          links={[
            { label: "Hombre", href: "/men" },
            { label: "Mujer", href: "/women" },
            { label: "Sneakers", href: "/sneakers" },
            { label: "Deportivo", href: "/sports" },
            { label: "Streetwear", href: "/streetwear" },
            { label: "New arrivals", href: "/new-arrivals" },
            { label: "Sale", href: "/sale" },
          ]}
        />
        <FooterCol
          title="Ayuda"
          links={[
            { label: "Rastrear pedido", href: "/orders/track" },
            { label: "Preguntas frecuentes", href: "/faq" },
            { label: "Contacto", href: "/contact" },
            { label: "Cambios y devoluciones", href: "/policies/cambios-y-devoluciones" },
            { label: "Mi cuenta", href: "/account" },
          ]}
        />
        <FooterCol title="Políticas" links={policyPages.map((p) => ({ label: p.title, href: `/policies/${p.slug}` }))} />
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Contacto</h2>
          <ul className="space-y-2 text-sm text-bone/70">
            {settings.address && <li>{settings.address}</li>}
            {settings.contactEmail && (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className="break-all hover:text-paper">{settings.contactEmail}</a>
              </li>
            )}
            {settings.contactPhone && <li>{settings.contactPhone}</li>}
            <li>
              <Link href="/contact" className="hover:text-paper">Escríbenos</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-line">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-6 text-xs text-smoke md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {year} {site.name} · {site.descriptor}</p>
          <p>Precios en pesos colombianos (COP), IVA incluido cuando aplique.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="md:col-span-2">
      <h2 className="eyebrow mb-4">{title}</h2>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-bone/70 transition-colors hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
