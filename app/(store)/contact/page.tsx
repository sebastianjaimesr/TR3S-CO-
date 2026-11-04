import type { Metadata } from "next";
import { getStoreSettings } from "@/services/catalog";
import { whatsappLink } from "@/services/whatsapp";
import { WhatsappIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Contacto", description: "Contacta a TR3S & CO. por WhatsApp, Instagram, TikTok o correo.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const s = await getStoreSettings();
  const wa = whatsappLink(s.whatsappNumber, "Hola TR3S & CO. Tengo una pregunta.");
  const channels = [
    wa && { label: "WhatsApp", value: "Respuesta más rápida", href: wa },
    s.contactEmail && { label: "Correo", value: s.contactEmail, href: `mailto:${s.contactEmail}` },
    s.contactPhone && { label: "Teléfono", value: s.contactPhone, href: `tel:${s.contactPhone.replace(/\s/g, "")}` },
    s.instagramUrl && { label: "Instagram", value: "Síguenos", href: s.instagramUrl },
    s.tiktokUrl && { label: "TikTok", value: "Síguenos", href: s.tiktokUrl },
  ].filter(Boolean) as { label: string; value: string; href: string }[];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
      <p className="eyebrow mb-3">Contacto</p>
      <h1 className="font-display text-5xl font-bold tracking-tight md:text-7xl">HABLEMOS.</h1>
      <p className="mt-4 max-w-xl text-bone/70">Tallas, disponibilidad, pedidos especiales o el estado de tu compra. {s.address ? `Estamos en ${s.address}.` : ""}</p>
      {channels.length ? (
        <ul className="mt-12 grid gap-3 md:grid-cols-2">
          {channels.map((c) => (
            <li key={c.label}>
              <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center justify-between border border-line bg-coal p-8 transition-colors hover:border-paper/40">
                <span>
                  <span className="block font-display text-2xl font-semibold">{c.label}</span>
                  <span className="text-sm text-smoke">{c.value}</span>
                </span>
                {c.label === "WhatsApp" ? <WhatsappIcon width={28} height={28} /> : <span aria-hidden>→</span>}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 border border-line p-8 text-smoke">Los canales de contacto se publican aquí cuando el administrador los configura en /admin → Configuración.</p>
      )}
    </div>
  );
}
