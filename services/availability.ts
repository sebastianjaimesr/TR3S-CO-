import type { AvailabilityStatus, Product, ProductVariant } from "@/types/domain";

const rank: Record<AvailabilityStatus, number> = {
  available_now: 2,
  available_on_order: 1,
  sold_out: 0,
};

export function statusFromQuantities(ownQuantity: number, supplierQuantity: number): AvailabilityStatus {
  if (ownQuantity > 0) return "available_now";
  if (supplierQuantity > 0) return "available_on_order";
  return "sold_out";
}

/** Best availability across all variants of a product. */
export function productAvailability(product: Pick<Product, "variants">): AvailabilityStatus {
  let best: AvailabilityStatus = "sold_out";
  for (const v of product.variants) {
    if (rank[v.availability.status] > rank[best]) best = v.availability.status;
  }
  return best;
}

export function shortestLeadTime(product: Pick<Product, "variants">): number | null {
  const times = product.variants
    .filter((v) => v.availability.status === "available_on_order" && v.availability.leadTimeDays != null)
    .map((v) => v.availability.leadTimeDays as number);
  return times.length ? Math.min(...times) : null;
}

export function variantPrice(product: Pick<Product, "price">, variant: Pick<ProductVariant, "price">): number {
  return variant.price ?? product.price;
}

export function isPurchasable(product: Pick<Product, "isDemo" | "isActive">, variant?: ProductVariant): boolean {
  if (product.isDemo || !product.isActive) return false;
  if (!variant) return true;
  return variant.availability.status !== "sold_out";
}

export const availabilityLabel: Record<AvailabilityStatus, string> = {
  available_now: "AVAILABLE NOW",
  available_on_order: "AVAILABLE ON ORDER",
  sold_out: "SOLD OUT",
};

export const availabilityHelp: Record<AvailabilityStatus, string> = {
  available_now: "En inventario propio. Despacho en 24–48 h hábiles.",
  available_on_order: "Bajo pedido: confirmamos con el proveedor antes de despachar.",
  sold_out: "Agotado en esta talla.",
};
