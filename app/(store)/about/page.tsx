import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "TR3S & CO. nace de tres fundadores en Bucaramanga: una tienda multimarca de calzado con una sola esencia.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow mb-4">Nosotros</p>
          <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">TRES ALMAS.<br />UNA ESENCIA.</h1>
          <p className="mt-6 max-w-xl font-editorial text-2xl italic text-bone/80">{site.descriptor}</p>
        </Reveal>
        <Reveal delay={0.1} className="flex justify-center lg:justify-end">
          <Logo size={420} href={null} className="max-w-full" />
        </Reveal>
      </div>
      <div className="prose-tr3s mt-20 grid gap-12 md:grid-cols-3">
        <section>
          <h2>TR3S</h2>
          <p>Tres fundadores, tres perspectivas y una misma visión empresarial. Cada referencia del catálogo pasa por los tres.</p>
        </section>
        <section>
          <h2>&amp;</h2>
          <p>La unión entre los fundadores, las marcas que comercializamos y las personas que nos compran.</p>
        </section>
        <section>
          <h2>CO.</h2>
          <p>Una compañía que empieza en Bucaramanga y Santander con visión de crecer a todo Colombia y, cuando la operación lo permita, fuera del país.</p>
        </section>
      </div>
      <section className="prose-tr3s mt-16 max-w-3xl border-t border-line pt-12">
        <h2>Cómo trabajamos</h2>
        <p>
          No fabricamos zapatos. Somos una tienda multimarca: elegimos productos de marcas y proveedores legítimos y te los presentamos con
          información clara.
        </p>
        <ul>
          <li><strong>Disponible ya:</strong> lo tenemos en nuestro inventario y sale en 24–48 horas hábiles.</li>
          <li><strong>Bajo pedido:</strong> lo pide nuestro proveedor; confirmamos la disponibilidad antes de despachar y te decimos el plazo.</li>
        </ul>
        <p>No somos distribuidores oficiales de las marcas salvo que lo indiquemos expresamente.</p>
        <p><Link href="/contact" className="underline">Escríbenos</Link> si buscas una referencia que no ves en el catálogo.</p>
      </section>
    </div>
  );
}
