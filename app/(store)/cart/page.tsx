import type { Metadata } from "next";
import { CartView } from "@/features/cart/CartView";
import { getStoreSettings } from "@/services/catalog";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };

export default async function CartPage() {
  const s = await getStoreSettings();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <h1 className="font-display text-5xl font-bold tracking-tight">CARRITO</h1>
      <CartView shippingFlatRate={s.shippingFlatRate} freeShippingFrom={s.freeShippingFrom} whatsappNumber={s.whatsappNumber} />
    </div>
  );
}
