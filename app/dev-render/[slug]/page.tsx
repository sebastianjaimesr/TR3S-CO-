import { notFound } from "next/navigation";
import { demoProducts } from "@/database/seed/demo-catalog";
import { RenderStage } from "./RenderStage";

/** Development-only route used by scripts/render-demo-images.mjs to render DEMO product images. */
export default async function DevRender({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { slug } = await params;
  const { view } = await searchParams;
  const p = demoProducts.find((d) => d.slug === slug);
  if (!p?.conceptColorway) notFound();
  return <RenderStage colorway={p.conceptColorway} view={view === "top" ? "top" : "side"} />;
}
