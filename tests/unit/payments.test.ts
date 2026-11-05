import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPreferenceBody, mapMercadoPagoStatus, parseSignatureHeader, signatureManifest, verifyWebhookSignature } from "@/services/payments/mercadopago";
import { PAYU_IMPLEMENTED, mapPayuState, payuConfirmationSignature, payuConfirmationValue, payuRequestSignature } from "@/services/payments/payu";
import { orderNumberFromReference } from "@/services/orders";

const secret = "mp_test_secret";
const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

describe("Mercado Pago webhook signature", () => {
  it("builds the manifest as documented (lower-cased alphanumeric id, omitted parts)", () => {
    expect(signatureManifest("123456", "req-1", "1700000000")).toBe("id:123456;request-id:req-1;ts:1700000000;");
    expect(signatureManifest("ABC123", "req-1", "1")).toBe("id:abc123;request-id:req-1;ts:1;");
    expect(signatureManifest(null, null, "1")).toBe("ts:1;");
  });
  it("parses the x-signature header", () => {
    expect(parseSignatureHeader("ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839")).toEqual({
      ts: "1704908010",
      v1: "618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839",
    });
    expect(parseSignatureHeader("garbage")).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });
  it("accepts a valid signature and rejects tampering", () => {
    const ts = "1704908010";
    const v1 = sign(signatureManifest("987654", "req-xyz", ts));
    const base = { signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-xyz", dataId: "987654", secret };
    expect(verifyWebhookSignature(base)).toBe(true);
    expect(verifyWebhookSignature({ ...base, dataId: "987655" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, requestId: "other" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: "wrong" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: "" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signatureHeader: `ts=${ts},v1=00` })).toBe(false);
  });
  it("rejects stale notifications when a max age is set", () => {
    const ts = "1704908010";
    const v1 = sign(signatureManifest("1", "r", ts));
    const opts = { signatureHeader: `ts=${ts},v1=${v1}`, requestId: "r", dataId: "1", secret, maxAgeSeconds: 600 };
    expect(verifyWebhookSignature({ ...opts, now: 1704908010_000 + 60_000 })).toBe(true);
    expect(verifyWebhookSignature({ ...opts, now: 1704908010_000 + 3_600_000 })).toBe(false);
  });
  it("maps statuses conservatively", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("approved");
    expect(mapMercadoPagoStatus("rejected")).toBe("declined");
    expect(mapMercadoPagoStatus("in_process")).toBe("pending");
    expect(mapMercadoPagoStatus("refunded")).toBe("voided");
  });
  it("builds a COP preference with integer amount and our reference", () => {
    const body = buildPreferenceBody({
      accessToken: "x",
      reference: "T3-261105-1001-2",
      amount: 315000,
      title: "Pedido T3-261105-1001",
      payer: { email: "a@b.co", firstName: "Ana", lastName: "Gómez" },
      backUrl: "https://tr3s.co/checkout/result",
      notificationUrl: "https://tr3s.co/api/webhooks/mercadopago",
    });
    expect(body.external_reference).toBe("T3-261105-1001-2");
    expect(body.items[0]).toMatchObject({ currency_id: "COP", unit_price: 315000, quantity: 1 });
    expect(() => buildPreferenceBody({ amount: 10.5 } as Parameters<typeof buildPreferenceBody>[0])).toThrow();
  });
});

describe("PayU helpers (prepared, not active)", () => {
  it("is not marked as implemented", () => {
    expect(PAYU_IMPLEMENTED).toBe(false);
  });
  it("matches PayU's documented request signature example", () => {
    expect(payuRequestSignature("4Vj8eK4rloUd272L48hsrarnUA", "508029", "TestPayU", 3, "USD")).toBe("ba9ffa71559580175585e45ce70b6c37");
  });
  it("applies the confirmation rounding rule", () => {
    expect(payuConfirmationValue("150000.00")).toBe("150000.0");
    expect(payuConfirmationValue(150000.5)).toBe("150000.5");
    expect(payuConfirmationValue("150000.25")).toBe("150000.25");
    expect(payuConfirmationSignature("k", "1", "r", "100.00", "COP", "4")).toBe(payuConfirmationSignature("k", "1", "r", 100, "COP", "4"));
  });
  it("maps state_pol", () => {
    expect(mapPayuState("4")).toBe("approved");
    expect(mapPayuState("6")).toBe("declined");
    expect(mapPayuState("7")).toBe("pending");
    expect(mapPayuState("99")).toBe("error");
  });
});

describe("payment references", () => {
  it("recovers the order number from first and retry references", () => {
    expect(orderNumberFromReference("T3-261105-1001")).toBe("T3-261105-1001");
    expect(orderNumberFromReference("T3-261105-1001-3")).toBe("T3-261105-1001");
    expect(orderNumberFromReference("t3-261105-1001-2")).toBe("T3-261105-1001");
    expect(orderNumberFromReference("X-1")).toBeNull();
    expect(orderNumberFromReference("T3-261105-1001-2; drop")).toBeNull();
  });
});

describe("provider availability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const all = { wompi: true, mercadopago: true, payu: true, transfer: true };

  it("never offers PayU and hides gateways without credentials", async () => {
    vi.stubEnv("WOMPI_PUBLIC_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_WOMPI_PUBLIC_KEY", "");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    const { availableProviders } = await import("@/services/payments/providers");
    expect(availableProviders(all).map((p) => p.id)).toEqual(["transfer"]);
  });

  it("respects the admin switches", async () => {
    const { availableProviders } = await import("@/services/payments/providers");
    expect(availableProviders({ wompi: false, mercadopago: false, payu: false, transfer: false })).toEqual([]);
  });

  it("offers Wompi in sandbox only when the key matches the environment", async () => {
    vi.stubEnv("WOMPI_PUBLIC_KEY", "pub_test_abc");
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_abc");
    vi.stubEnv("WOMPI_EVENTS_SECRET", "test_events_abc");
    vi.stubEnv("WOMPI_ENV", "sandbox");
    let mod = await import("@/services/payments/providers");
    expect(mod.availableProviders(all).find((p) => p.id === "wompi")).toMatchObject({ sandbox: true });
    vi.resetModules();
    vi.stubEnv("WOMPI_ENV", "production");
    mod = await import("@/services/payments/providers");
    expect(mod.availableProviders(all).some((p) => p.id === "wompi")).toBe(false);
  });
});
