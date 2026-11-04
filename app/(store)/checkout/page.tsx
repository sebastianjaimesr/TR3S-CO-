import type { Metadata } from "next";
import { CheckoutForm } from "@/features/checkout/CheckoutForm";
import { getStoreSettings } from "@/services/catalog";
import { isSupabaseConfigured, isWompiConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const s = await getStoreSettings();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <h1 className="mb-10 font-display text-5xl font-bold tracking-tight">CHECKOUT</h1>
      <CheckoutForm
        shippingFlatRate={s.shippingFlatRate}
        freeShippingFrom={s.freeShippingFrom}
        methods={s.paymentMethods}
        ready={{ database: isSupabaseConfigured(), wompi: isWompiConfigured() }}
      />
    </div>
  );
}
