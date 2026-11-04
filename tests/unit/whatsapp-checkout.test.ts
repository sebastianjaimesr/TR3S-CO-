import { describe, expect, it } from "vitest";
import { cartSummaryMessage, normalizeWhatsappNumber, productInquiryMessage, whatsappLink } from "@/services/whatsapp";
import { checkoutErrorMessage, checkoutSchema } from "@/validations/checkout";
import { cartTotals, type CartItem } from "@/features/cart/store";

describe("WhatsApp", () => {
  it("normalizes Colombian numbers and rejects junk", () => {
    expect(normalizeWhatsappNumber("300 123 4567")).toBe("573001234567");
    expect(normalizeWhatsappNumber("+57 300-123-4567")).toBe("573001234567");
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
  });
  it("returns no link when no number is configured (never a dead button)", () => {
    expect(whatsappLink(null, "hola")).toBeNull();
  });
  it("builds the requested product message", () => {
    expect(productInquiryMessage({ brand: "Marca", name: "Modelo", sku: "REF-1", size: "42", color: "Negro" })).toBe(
      "Hola TR3S & CO. Estoy interesado en Marca Modelo, referencia REF-1, talla 42, color Negro. ¿Me pueden confirmar disponibilidad?",
    );
    const link = whatsappLink("3001234567", "Hola & chao")!;
    expect(link).toBe("https://wa.me/573001234567?text=Hola%20%26%20chao");
  });
  it("summarizes the cart", () => {
    const msg = cartSummaryMessage([{ name: "M", brand: "B", sku: "S", size: "40", color: "Rojo", quantity: 2, price: 100000 }], 200000);
    expect(msg).toContain("2 x B M — ref S, talla 40, Rojo ($ 200.000)");
    expect(msg).toContain("Subtotal: $ 200.000");
  });
});

describe("checkout validation", () => {
  const valid = {
    firstName: "Ana", lastName: "Ruiz", email: "ANA@MAIL.CO ", phone: "300 123 4567", department: "Santander", city: "Bucaramanga",
    address: "Calle 45 # 12-30", paymentMethod: "wompi", acceptPolicies: true, idempotencyKey: "a".repeat(32),
    items: [{ variantId: "5f0c9d43-8c47-4c43-9d2a-6f2a3f7c1b11", quantity: 1 }],
  };
  it("accepts and normalizes a valid order", () => {
    const r = checkoutSchema.parse(valid);
    expect(r.email).toBe("ana@mail.co");
    expect(r.phone).toBe("3001234567");
  });
  it("rejects demo variants, missing policy consent and bad phones", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [{ variantId: "demo-concept-01-40", quantity: 1 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, acceptPolicies: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [{ ...valid.items[0], quantity: 11 }] }).success).toBe(false);
  });
  it("maps DB errors to customer messages", () => {
    expect(checkoutErrorMessage("OUT_OF_STOCK:SKU")).toMatch(/agotó/);
    expect(checkoutErrorMessage("DEMO_PRODUCT_NOT_PURCHASABLE:x")).toMatch(/DEMO/);
  });
});

describe("cart totals", () => {
  const item = (price: number, quantity: number) => ({ price, quantity }) as CartItem;
  it("charges flat shipping below the free threshold", () => {
    expect(cartTotals([item(100000, 1)], 15000, 400000)).toMatchObject({ subtotal: 100000, shipping: 15000, total: 115000 });
  });
  it("free shipping from the threshold, no shipping on empty cart", () => {
    expect(cartTotals([item(200000, 2)], 15000, 400000).shipping).toBe(0);
    expect(cartTotals([], 15000, 400000).total).toBe(0);
  });
});
