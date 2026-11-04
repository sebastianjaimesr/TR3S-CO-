import "server-only";
import {
  isMercadoPagoConfigured,
  isWompiConfigured,
  mercadoPagoTokenEnvironment,
  publicEnv,
  serverEnv,
  wompiKeyEnvironment,
  type PaymentEnvironment,
} from "@/lib/env";
import { buildCheckoutUrl } from "@/services/payments/wompi";
import { createPreference } from "@/services/payments/mercadopago";
import { PAYU_IMPLEMENTED } from "@/services/payments/payu";
import type { PaymentMethodId } from "@/types/domain";

/**
 * Payment provider abstraction. The checkout never talks to a gateway
 * directly: it asks the provider registry for a redirect URL. Amounts and
 * references always come from `start_order_payment` in the database.
 */
export interface PaymentRequest {
  orderNumber: string;
  /** Unique per attempt (order number, then -2, -3…). */
  reference: string;
  /** COP whole pesos, computed by the server. */
  amount: number;
  email: string;
  firstName: string;
  lastName: string;
  /** Customer's order page (includes the access token). */
  returnUrl: string;
  expiresAt: string | null;
}

export interface PaymentProvider {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Code path finished (false = prepared for a later phase). */
  implemented: boolean;
  /** Credentials present and consistent. */
  configured(): boolean;
  environment(): PaymentEnvironment | null;
  /** Human-readable reasons why the provider is not ready (for the admin). */
  issues(): string[];
  /** Returns the URL the buyer must be sent to. Offline methods return null. */
  createRedirect(req: PaymentRequest): Promise<string | null>;
}

const wompi: PaymentProvider = {
  id: "wompi",
  label: "Wompi",
  description: "Tarjeta débito o crédito, PSE, Nequi, botón Bancolombia. Pagas en la plataforma segura de Wompi.",
  implemented: true,
  configured: isWompiConfigured,
  environment: () => (publicEnv.wompiPublicKey ? serverEnv().wompiEnv : null),
  issues() {
    const s = serverEnv();
    const out: string[] = [];
    if (!publicEnv.wompiPublicKey) out.push("Falta WOMPI_PUBLIC_KEY (o NEXT_PUBLIC_WOMPI_PUBLIC_KEY).");
    if (!s.wompiIntegritySecret) out.push("Falta WOMPI_INTEGRITY_SECRET.");
    if (!s.wompiEventsSecret) out.push("Falta WOMPI_EVENTS_SECRET.");
    const keyEnv = publicEnv.wompiPublicKey ? wompiKeyEnvironment(publicEnv.wompiPublicKey) : null;
    if (publicEnv.wompiPublicKey && keyEnv !== s.wompiEnv)
      out.push(`La llave pública es de ${keyEnv ?? "formato desconocido"} pero WOMPI_ENVIRONMENT=${s.wompiEnv}.`);
    return out;
  },
  async createRedirect(req) {
    return buildCheckoutUrl({
      publicKey: publicEnv.wompiPublicKey,
      reference: req.reference,
      amountInCents: req.amount * 100,
      integritySecret: serverEnv().wompiIntegritySecret,
      redirectUrl: req.returnUrl,
      customerEmail: req.email,
    });
  },
};

const mercadopago: PaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  description: "Tarjetas, PSE, Efecty y saldo Mercado Pago. Pagas en la plataforma segura de Mercado Pago.",
  implemented: true,
  configured: isMercadoPagoConfigured,
  environment: () => {
    const s = serverEnv();
    return s.mercadoPagoAccessToken ? s.mercadoPagoEnv : null;
  },
  issues() {
    const s = serverEnv();
    const out: string[] = [];
    if (!s.mercadoPagoAccessToken) out.push("Falta MERCADOPAGO_ACCESS_TOKEN.");
    if (!s.mercadoPagoWebhookSecret) out.push("Falta MERCADOPAGO_WEBHOOK_SECRET (firma secreta de Webhooks).");
    const tokenEnv = s.mercadoPagoAccessToken ? mercadoPagoTokenEnvironment(s.mercadoPagoAccessToken) : null;
    if (s.mercadoPagoAccessToken && !tokenEnv) out.push("El access token no tiene el formato esperado (TEST-… o APP_USR-…).");
    return out;
  },
  async createRedirect(req) {
    const pref = await createPreference(
      {
        accessToken: serverEnv().mercadoPagoAccessToken,
        reference: req.orderNumber,
        amount: req.amount,
        title: `Pedido ${req.orderNumber} · TR3S & CO.`,
        payer: { email: req.email, firstName: req.firstName, lastName: req.lastName },
        backUrl: req.returnUrl,
        notificationUrl: `${publicEnv.siteUrl}/api/webhooks/mercadopago`,
        expiresAt: req.expiresAt,
      },
      `tr3s-${req.reference}`,
    );
    return pref.initPoint;
  },
};

const payu: PaymentProvider = {
  id: "payu",
  label: "PayU",
  description: "Preparado para una fase posterior.",
  implemented: PAYU_IMPLEMENTED,
  configured: () => {
    const s = serverEnv();
    return Boolean(s.payuApiKey && s.payuMerchantId && s.payuAccountId);
  },
  environment: () => (serverEnv().payuApiKey ? serverEnv().payuEnv : null),
  issues: () => ["Integración preparada (firmas y estados), pendiente de activar: falta el redireccionamiento y la página de confirmación."],
  async createRedirect() {
    throw new Error("PAYU_NOT_IMPLEMENTED");
  },
};

const transfer: PaymentProvider = {
  id: "transfer",
  label: "Transferencia bancaria",
  description: "Reservamos tu pedido 48 h mientras confirmamos el pago en el banco.",
  implemented: true,
  configured: () => true,
  environment: () => null,
  issues: () => [],
  async createRedirect() {
    return null;
  },
};

export const providers: Record<PaymentMethodId, PaymentProvider> = { wompi, mercadopago, payu, transfer };

export function getProvider(id: string): PaymentProvider | null {
  return (providers as Record<string, PaymentProvider>)[id] ?? null;
}

/** Providers a customer can use right now: switched on by the admin AND ready in code and credentials. */
export function availableProviders(enabled: Record<PaymentMethodId, boolean>) {
  return (Object.values(providers) as PaymentProvider[])
    .filter((p) => enabled[p.id] && p.implemented && p.configured())
    .map((p) => ({ id: p.id, label: p.label, description: p.description, sandbox: p.environment() === "sandbox" }));
}

export type AvailableProvider = ReturnType<typeof availableProviders>[number];
