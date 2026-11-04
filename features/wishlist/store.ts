"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WishlistEntry {
  productId: string;
  slug: string;
  addedAt: string;
}

interface WishlistState {
  items: WishlistEntry[];
  toggle: (e: Omit<WishlistEntry, "addedAt">) => void;
  has: (productId: string) => boolean;
  remove: (productId: string) => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (e) =>
        set((s) =>
          s.items.some((i) => i.productId === e.productId)
            ? { items: s.items.filter((i) => i.productId !== e.productId) }
            : { items: [...s.items, { ...e, addedAt: new Date().toISOString() }] },
        ),
      has: (productId) => get().items.some((i) => i.productId === productId),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
    }),
    { name: "tr3s-wishlist-v1", storage: createJSONStorage(() => localStorage) },
  ),
);
