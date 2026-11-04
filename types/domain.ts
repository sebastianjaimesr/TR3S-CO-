export type Gender = "men" | "women" | "unisex";

export type AvailabilityStatus = "available_now" | "available_on_order" | "sold_out";

export type PaymentMethodId = "wompi" | "mercadopago" | "payu" | "transfer";

export type FulfillmentType = "own" | "on_order";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isDemo: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}

/** Colorway used by the procedural concept sneaker (DEMO products only). */
export interface ConceptColorway {
  upper: string;
  accent: string;
  sole: string;
  midsole: string;
  laces: string;
}

export interface ProductImage {
  url: string;
  alt: string;
  position: number;
}

export interface VariantAvailability {
  status: AvailabilityStatus;
  /** Units physically in own inventory (never mixed with supplier stock). */
  ownQuantity: number;
  /** Supplier-reported quantity from the freshest confirmation, if any. */
  supplierQuantity: number;
  /** Delivery estimate in days for on-order items. */
  leadTimeDays: number | null;
  /** ISO date of the last supplier confirmation. */
  supplierConfirmedAt: string | null;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  /** Price in COP (integer pesos). Overrides product price when set. */
  price: number | null;
  availability: VariantAvailability;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  reference: string;
  brand: Brand;
  category: Category;
  gender: Gender;
  shoeType: string;
  description: string;
  materials: string | null;
  /** Base price in COP. */
  price: number;
  /** Real previous price; only set when a real discount exists. */
  compareAtPrice: number | null;
  isNew: boolean;
  /** Manual merchandising rank (lower first); null when not featured. */
  featuredRank?: number | null;
  isActive: boolean;
  /** DEMO products can never be purchased. */
  isDemo: boolean;
  images: ProductImage[];
  /** Authorized GLB model for this exact reference. */
  modelUrl: string | null;
  /** Procedural concept colorway (DEMO only, never a real product). */
  conceptColorway: ConceptColorway | null;
  variants: ProductVariant[];
  createdAt: string;
}

export interface HeroCampaign {
  headline: string[];
  subheadline: string;
  monumentalWords: string[];
  productSlugs: string[];
  fallbackImageUrl: string | null;
}

export interface StoreSettings {
  whatsappNumber: string | null;
  shippingFlatRate: number;
  freeShippingFrom: number | null;
  bankTransferInstructions: string | null;
  paymentMethods: Record<PaymentMethodId, boolean>;
  storeDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
}

export interface CatalogFilters {
  q?: string;
  brand?: string[];
  category?: string[];
  gender?: Gender[];
  size?: string[];
  color?: string[];
  minPrice?: number;
  maxPrice?: number;
  availability?: AvailabilityStatus[];
  shoeType?: string[];
  onSale?: boolean;
  isNew?: boolean;
  sort?: "featured" | "price_asc" | "price_desc" | "newest" | "name";
  page?: number;
  pageSize?: number;
}
