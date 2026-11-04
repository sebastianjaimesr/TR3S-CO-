import type { Metadata } from "next";

export const metadata: Metadata = { title: "Preguntas frecuentes", alternates: { canonical: "/faq" } };

const faqs = [
  ["¿Los productos son originales?", "Comercializamos productos de marcas y proveedores legítimos. Si tienes dudas sobre una referencia, pregúntanos antes de comprar y te contamos su procedencia."],
  ["¿Qué significa “Available now”?", "El par está en nuestro inventario propio. Lo despachamos en 24–48 horas hábiles después de confirmar el pago."],
  ["¿Qué significa “Available on order”?", "El par lo suministra un proveedor. Confirmamos la disponibilidad con él antes de despachar y te mostramos el plazo estimado. Si el proveedor no lo tiene, te devolvemos el 100% del dinero."],
  ["¿Cómo elijo mi talla?", "Usa la guía de tallas de cada producto. Cada marca horma distinto; si estás entre dos tallas, escríbenos por WhatsApp."],
  ["¿Qué métodos de pago aceptan?", "Wompi (tarjeta, PSE, Nequi y otros medios habilitados por Wompi) y transferencia bancaria. No almacenamos datos de tarjetas."],
  ["¿Hacen envíos a toda Colombia?", "Sí. El costo de envío se muestra en el carrito y en el checkout antes de pagar."],
  ["¿Puedo cambiar la talla?", "Sí, según nuestra política de cambios: producto sin uso, con etiquetas y caja original, sujeto a disponibilidad."],
  ["¿Cómo sigo mi pedido?", "En “Rastrear pedido” con tu número de pedido y el correo con el que compraste."],
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow mb-3">Ayuda</p>
      <h1 className="font-display text-5xl font-bold tracking-tight">FAQ</h1>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {faqs.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg">
              {q}
              <span aria-hidden className="text-smoke transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-bone/75">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
