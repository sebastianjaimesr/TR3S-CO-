import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "admin" | "sales" | "inventory";

export interface Staff {
  userId: string;
  email: string;
  roles: Role[];
  sb: NonNullable<Awaited<ReturnType<typeof supabaseServer>>>;
}

export function can(staff: Pick<Staff, "roles">, needed: Role[]): boolean {
  return staff.roles.includes("admin") || needed.some((r) => staff.roles.includes(r));
}

/** Server-side authorization for admin pages and actions (RLS re-checks every query). */
export async function getStaff(): Promise<Staff | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: roles } = await sb.from("user_roles").select("role_id").eq("user_id", data.user.id);
  if (!roles?.length) return null;
  return { userId: data.user.id, email: data.user.email ?? "", roles: roles.map((r) => r.role_id as Role), sb };
}

export async function requireStaff(needed: Role[] = []): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login?next=/admin");
  if (needed.length && !can(staff, needed)) redirect("/admin?denied=1");
  return staff;
}
