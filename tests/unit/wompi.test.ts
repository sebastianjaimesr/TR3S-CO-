import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCheckoutUrl, eventChecksum, integritySignature, mapWompiStatus, verifyEvent, type WompiEvent } from "@/services/payments/wompi";

describe("Wompi integrity signature", () => {
  it("matches the example from Wompi's documentation", () => {
    expect(integritySignature("sk8-438k4-xmxm392-sn2m", 2490000, "COP", "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6")).toBe(
      "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5",
    );
  });
  it("rejects non-integer or negative amounts", () => {
    expect(() => integritySignature("r", 10.5, "COP", "s")).toThrow();
    expect(() => integritySignature("r", 0, "COP", "s")).toThrow();
  });
  it("builds a checkout URL with all required params", () => {
    const url = new URL(buildCheckoutUrl({ publicKey: "pub_test_x", reference: "T3-261104-1001", amountInCents: 31500000, integritySecret: "s", redirectUrl: "https://tr3s.co/checkout/result?order=T3-261104-1001" }));
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_x");
    expect(url.searchParams.get("amount-in-cents")).toBe("31500000");
    expect(url.searchParams.get("currency")).toBe("COP");
    expect(url.searchParams.get("signature:integrity")).toHaveLength(64);
  });
});

describe("Wompi event checksum", () => {
  const event: WompiEvent = {
    event: "transaction.updated",
    data: { transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4490000, reference: "MZQ3X2DE2SMX", currency: "COP" } },
    environment: "prod",
    signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
    timestamp: 1530291411,
  };
  const secret = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";

  // Wompi docs (eventos) build this exact string for the example. The hash printed in the docs
  // does not match its own string, so we assert against SHA256 of the documented concatenation.
  const documented = "1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
  it("hashes properties + timestamp + secret in the documented order", () => {
    expect(eventChecksum(event, secret)).toBe(createHash("sha256").update(documented).digest("hex"));
  });
  it("accepts a valid event (case-insensitive checksum)", () => {
    const upper = createHash("sha256").update(documented).digest("hex").toUpperCase();
    expect(verifyEvent({ ...event, signature: { ...event.signature, checksum: upper } }, secret)).toBe(true);
  });
  it("rejects tampered amount, wrong secret and malformed events", () => {
    const good = { ...event, signature: { ...event.signature, checksum: eventChecksum(event, secret) } };
    const tampered = { ...good, data: { transaction: { ...event.data.transaction!, amount_in_cents: 100 } } };
    expect(verifyEvent(tampered, secret)).toBe(false);
    expect(verifyEvent(good, "other")).toBe(false);
    expect(verifyEvent({ ...good, signature: { properties: [], checksum: "zz" } }, secret)).toBe(false);
    expect(verifyEvent({} as WompiEvent, secret)).toBe(false);
  });
  it("maps statuses", () => {
    expect(mapWompiStatus("APPROVED")).toBe("approved");
    expect(mapWompiStatus("DECLINED")).toBe("declined");
  });
});
