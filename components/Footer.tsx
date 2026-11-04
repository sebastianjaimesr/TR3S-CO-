import Link from "next/link";
import { Logo } from "@/components/Logo";
import { mainNav, policyPages, site } from "@/lib/site";
import type { StoreSettings } from "@/types/domain";

export function Footer({ settings }: { settings: StoreSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-4 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-4">
          <Logo size={140} />
          <p className="mt-6 font-display text-sm tracking-[0.3em] text-paper">{site.slogan}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-smoke">
            Tienda multimarca independiente de calzado en {site.city}. No somos fabricantes ni distribuidores oficiales de las marcas
            que comercializamos.
          </p>
        </div>
        <FooterCol title="Tienda" links={[{ label: "Shop", href: "/shop" }, ...mainNav.map((n) => ({ label: n.label, href: n.href }))]} />
        <FooterCol
          title="Ayuda"
          links={[
            { label: "Rastrear pedido", href: "/orders/track" },
            { label: "Preguntas frecuentes", href: "/faq" },
            { label: "Contacto", href: "/contact" },
            { label: "Mi cuenta", href: "/account" },
            { label: "Nosotros", href: "/about" },
          ]}
        />
        <FooterCol title="Políticas" links={policyPages.map((p) => ({ label: p.title, href: `/policies/${p.slug}` }))} />
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Contacto</h2>
          <ul className="space-y-2 text-sm text-bone/70">
            {settings.address && <li>{settings.address}</li>}
            {settings.contactEmail && (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-paper">{settings.contactEmail}</a>
              </li>
            )}
            {settings.contactPhone && <li>{settings.contactPhone}</li>}
            {settings.instagramUrl && (
              <li>
                <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-paper">Instagram</a>
              </li>
            )}
            {settings.tiktokUrl && (
              <li>
                <a href={settings.tiktokUrl} target="_blank" rel="noopener noreferrer" className="hover:text-paper">TikTok</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
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
