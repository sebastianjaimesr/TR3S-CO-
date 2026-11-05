import type { Metadata } from "next";
import { CheckoutForm } from "@/features/checkout/CheckoutForm";
import { getStoreSettings } from "@/services/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { availableProviders } from "@/services/payments/providers";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const s = await getStoreSettings();
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <p className="eyebrow mb-3">Compra segura</p>
      <h1 className="mb-10 font-display text-5xl font-bold tracking-tight md:text-6xl">CHECKOUT</h1>
      <CheckoutForm
        shippingFlatRate={s.shippingFlatRate}
        freeShippingFrom={s.freeShippingFrom}
        providers={availableProviders(s.paymentMethods)}
        databaseReady={isSupabaseConfigured()}
      />
    </div>
  );
}
