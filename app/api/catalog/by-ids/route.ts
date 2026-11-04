import { NextResponse } from "next/server";
import { getAllProducts } from "@/services/catalog";

/** Public catalog lookup used by the wishlist (ids live in the browser). */
export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 100) ?? [];
  const all = await getAllProducts();
  const set = new Set(ids);
  return NextResponse.json(all.filter((p) => set.has(p.id)), { headers: { "Cache-Control": "public, s-maxage=60" } });
}
