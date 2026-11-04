"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/types/domain";
import { useWishlist } from "@/features/wishlist/store";
import { useHydrated } from "@/hooks/useHydrated";
import { ProductCard } from "@/features/catalog/ProductCard";

export function WishlistView() {
  const hydrated = useHydrated();
  const items = useWishlist((s) => s.items);
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = items.map((i) => i.productId).join(",");

  useEffect(() => {
    if (!hydrated) return;
    if (!key) return setProducts([]);
    fetch(`/api/catalog/by-ids?ids=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [hydrated, key]);

  if (!hydrated || products === null) return <div className="mt-10 h-64 animate-pulse bg-coal" aria-busy="true" />;
  if (products.length === 0)
    return (
      <div className="mt-10 border border-line p-12 text-center">
        <p className="font-display text-2xl">Aún no guardas productos.</p>
        <Link href="/shop" className="btn btn-primary mt-6">Explorar</Link>
      </div>
    );
  return (
    <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
