import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/services/catalog";

export function done(path: string, ok: string): never {
  revalidatePath(path);
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(ok)}`);
}

export function fail(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
}

export function refreshCatalog() {
  revalidateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

export const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (f: FormData, k: string) => str(f, k) || null;
export const int = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[^\d-]/g, "");
  return v ? parseInt(v, 10) : null;
};
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

/** Maps Postgres/RLS errors to readable Spanish messages. */
export function dbError(message: string): string {
  if (message.includes("duplicate key")) return "Ya existe un registro con ese identificador (slug/SKU/código).";
  if (message.includes("row-level security") || message.includes("FORBIDDEN") || message.includes("permission denied")) return "Tu rol no tiene permiso para esta operación.";
  if (message.includes("violates foreign key")) return "El registro está en uso (por ejemplo, en pedidos) y no se puede eliminar. Desactívalo.";
  if (message.includes("check constraint")) return "Valor inválido (revisa cantidades, precios o formatos).";
  if (message.includes("INVALID_TRANSITION")) return "Ese cambio de estado no está permitido desde el estado actual.";
  return message;
}
