/**
 * Image slots of the home page. Each slot shows the owner's photo once it is
 * uploaded in /admin/home; until then the design renders a graphic brand panel
 * (never a stock or AI image of a product).
 */
export const homeMediaSlots = [
  { slot: "hero-centro", label: "Hero · protagonista central (Air Max 97)", hint: "PNG o WEBP SIN FONDO (recortado). Vista lateral de 3/4 mirando a la derecha. Mín. 2000 px.", stage: true },
  { slot: "hero-izquierda", label: "Hero · lado izquierdo (Air Max Plus TN)", hint: "PNG o WEBP SIN FONDO. Ángulo distinto al central, ideal frontal 3/4 apuntando hacia el centro. Mín. 1600 px.", stage: true },
  { slot: "hero-derecha", label: "Hero · lado derecho (Dunk Low Panda)", hint: "PNG o WEBP SIN FONDO. Ángulo distinto, ideal lateral o trasera 3/4 apuntando hacia el centro. Mín. 1600 px.", stage: true },
  { slot: "hero", label: "Fondo del hero (opcional)", hint: "Foto horizontal oscura detrás del texto. Mín. 2000 px de ancho." },
  { slot: "cat-hombre", label: "Categoría HOMBRE", hint: "Vertical 4:5." },
  { slot: "cat-mujer", label: "Categoría MUJER", hint: "Vertical 4:5." },
  { slot: "cat-sneakers", label: "Categoría SNEAKERS", hint: "Vertical 4:5." },
  { slot: "cat-deportivo", label: "Categoría DEPORTIVO", hint: "Vertical 4:5." },
  { slot: "cat-streetwear", label: "Categoría STREETWEAR", hint: "Vertical 4:5." },
  { slot: "banner", label: "Banner «El estilo no se explica»", hint: "Panorámica 21:9, estilo urbano." },
  { slot: "story", label: "Sección de marca (los tres)", hint: "Foto del equipo o de la tienda. 4:5." },
] as const;

/** The three hero stage positions, in visual order (left, center, right). */
export const heroStageSlots = ["hero-izquierda", "hero-centro", "hero-derecha"] as const;
export type HeroStageSlot = (typeof heroStageSlots)[number];

export type HomeMediaSlot = (typeof homeMediaSlots)[number]["slot"];

export type HomeMedia = Partial<Record<HomeMediaSlot, { url: string; alt: string }>>;
