import type { Metadata } from "next";
import { TrackForm } from "@/features/account/TrackForm";

export const metadata: Metadata = { title: "Rastrear pedido", alternates: { canonical: "/orders/track" } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <p className="eyebrow mb-3">Order tracking</p>
      <h1 className="font-display text-5xl font-bold tracking-tight">RASTREAR PEDIDO</h1>
      <TrackForm defaultNumber={number} />
    </div>
  );
}
