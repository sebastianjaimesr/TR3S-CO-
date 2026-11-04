/**
 * Image slots of the home page. Each slot shows the owner's photo once it is
 * uploaded in /admin/home; until then the design renders a graphic brand panel
 * (never a stock or AI image of a product).
 */
export const homeMediaSlots = [
  { slot: "hero", label: "Hero principal", hint: "Foto horizontal de tenis protagonista sobre fondo oscuro. Mín. 2000 px de ancho." },
  { slot: "cat-hombre", label: "Categoría HOMBRE", hint: "Vertical 4:5." },
  { slot: "cat-mujer", label: "Categoría MUJER", hint: "Vertical 4:5." },
  { slot: "cat-sneakers", label: "Categoría SNEAKERS", hint: "Vertical 4:5." },
  { slot: "cat-deportivo", label: "Categoría DEPORTIVO", hint: "Vertical 4:5." },
  { slot: "cat-streetwear", label: "Categoría STREETWEAR", hint: "Vertical 4:5." },
  { slot: "banner", label: "Banner «El estilo no se explica»", hint: "Panorámica 21:9, estilo urbano." },
  { slot: "story", label: "Sección de marca (los tres)", hint: "Foto del equipo o de la tienda. 4:5." },
] as const;

export type HomeMediaSlot = (typeof homeMediaSlots)[number]["slot"];

export type HomeMedia = Partial<Record<HomeMediaSlot, { url: string; alt: string }>>;
