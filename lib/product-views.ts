/**
 * Standard commercial views for product photography, in gallery order.
 * The chosen view becomes the image caption (alt) and its position, so the
 * gallery always shows lateral → frontal → trasera → superior → suela → lifestyle.
 */
export const PRODUCT_VIEWS = [
  { id: "lateral", label: "Vista lateral" },
  { id: "medial", label: "Vista medial" },
  { id: "frontal", label: "Vista frontal" },
  { id: "trasera", label: "Vista trasera" },
  { id: "superior", label: "Vista superior" },
  { id: "suela", label: "Vista de la suela" },
  { id: "detalle", label: "Detalle" },
  { id: "lifestyle", label: "Lifestyle" },
] as const;

export type ProductViewId = (typeof PRODUCT_VIEWS)[number]["id"];

export function viewPosition(id: string, seq = 0) {
  const i = PRODUCT_VIEWS.findIndex((v) => v.id === id);
  return (i < 0 ? PRODUCT_VIEWS.length : i) * 100 + seq;
}

export function viewLabel(id: string) {
  return PRODUCT_VIEWS.find((v) => v.id === id)?.label ?? "Foto";
}
