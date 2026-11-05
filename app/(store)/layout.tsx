import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { DemoBanner } from "@/components/DemoBanner";
import { ConsentAnalytics } from "@/components/ConsentAnalytics";
import { CartDrawer } from "@/features/cart/CartDrawer";
import { Toaster } from "@/features/ui/Toaster";
import { Cursor } from "@/components/Cursor";
import { getStoreSettings, isDemoMode } from "@/services/catalog";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getStoreSettings();
  return (
    <>
      <a href="#main" className="sr-only z-[100] bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      {isDemoMode() && <DemoBanner />}
      <Header />
      <main id="main">{children}</main>
      <Footer settings={settings} />
      <CartDrawer whatsappNumber={settings.whatsappNumber} shippingFlatRate={settings.shippingFlatRate} freeShippingFrom={settings.freeShippingFrom} />
      <WhatsAppFloat number={settings.whatsappNumber} />
      <ConsentAnalytics />
      <Toaster />
      <Cursor />
    </>
  );
}
