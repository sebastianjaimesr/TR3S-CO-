"use client";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";

type Consent = "granted" | "denied" | null;
const KEY = "tr3s-consent-v1";

/**
 * GA4 and Meta Pixel load ONLY after explicit consent (Ley 1581 de 2012).
 * Nothing renders when no analytics IDs are configured.
 */
export function ConsentAnalytics() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);
  const hasAny = Boolean(publicEnv.ga4Id || publicEnv.metaPixelId);

  useEffect(() => {
    setConsent((localStorage.getItem(KEY) as Consent) ?? null);
    setReady(true);
  }, []);

  if (!hasAny || !ready) return null;

  const decide = (v: Exclude<Consent, null>) => {
    localStorage.setItem(KEY, v);
    setConsent(v);
  };

  return (
    <>
      {consent === null && (
        <div role="dialog" aria-label="Cookies" className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl border border-line bg-coal p-5 shadow-2xl md:inset-x-auto md:left-6">
          <p className="text-sm text-bone/80">
            Usamos cookies de analítica para mejorar la tienda solo si nos das permiso. Lee nuestra{" "}
            <Link href="/policies/privacidad" className="underline">política de privacidad</Link>.
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="btn btn-primary h-10 min-h-0" onClick={() => decide("granted")}>Aceptar</button>
            <button type="button" className="btn btn-ghost h-10 min-h-0" onClick={() => decide("denied")}>Rechazar</button>
          </div>
        </div>
      )}
      {consent === "granted" && publicEnv.ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${publicEnv.ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${publicEnv.ga4Id}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {consent === "granted" && publicEnv.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${publicEnv.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
