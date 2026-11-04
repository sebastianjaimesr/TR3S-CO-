import type { Metadata } from "next";
import { WishlistView } from "@/features/wishlist/WishlistView";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <h1 className="font-display text-5xl font-bold tracking-tight">WISHLIST</h1>
      <p className="mt-3 text-sm text-smoke">Se guarda en este dispositivo.</p>
      <WishlistView />
    </div>
  );
}
