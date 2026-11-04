import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { policies } from "@/lib/policies";
import { policyPages } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = policies[slug];
  return p ? { title: p.title, alternates: { canonical: `/policies/${slug}` } } : {};
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const p = policies[slug];
  if (!p) notFound();
  return (
    <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 md:grid-cols-[220px_1fr] md:px-8">
      <nav aria-label="Políticas" className="text-sm">
        <p className="eyebrow mb-4">Políticas</p>
        <ul className="space-y-2">
          {policyPages.map((x) => (
            <li key={x.slug}>
              <Link href={`/policies/${x.slug}`} aria-current={x.slug === slug ? "page" : undefined} className={x.slug === slug ? "text-paper" : "text-smoke hover:text-paper"}>
                {x.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-tr3s">
        <h1 className="font-display text-4xl font-bold tracking-tight">{p.title}</h1>
        {p.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((t) => <p key={t}>{t}</p>)}
          </section>
        ))}
      </article>
    </div>
  );
}
