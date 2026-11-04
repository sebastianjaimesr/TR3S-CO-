"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AvailabilityStatus } from "@/types/domain";

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  sku: string;
  size: string;
  color: string;
  /** Display price only. The server always recomputes prices from the database. */
  price: number;
  image: string | null;
  quantity: number;
  isDemo: boolean;
  availability: AvailabilityStatus;
  leadTimeDays: number | null;
}

interface CartState {
  items: CartItem[];
  open: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

export const MAX_QTY = 10;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      add: (item, quantity = 1) =>
        set((s) => {
          if (item.availability === "sold_out") return s;
          const existing = s.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? s.items.map((i) =>
                i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i,
              )
            : [...s.items, { ...item, quantity: Math.min(MAX_QTY, quantity) }];
          return { items, open: true };
        }),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          items:
            quantity <= 0
              ? s.items.filter((i) => i.variantId !== variantId)
              : s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i)),
        })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: "tr3s-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

export function cartTotals(items: CartItem[], shippingFlatRate: number, freeShippingFrom: number | null) {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const count = items.reduce((acc, i) => acc + i.quantity, 0);
  const shipping = items.length === 0 ? 0 : freeShippingFrom != null && subtotal >= freeShippingFrom ? 0 : shippingFlatRate;
  return { subtotal, count, shipping, total: subtotal + shipping };
}
