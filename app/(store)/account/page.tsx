import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/features/account/auth-actions";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel } from "@/features/account/status";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const sb = await supabaseServer();
  if (!sb) redirect("/login");
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/account");
  const [{ data: orders }, { data: roles }] = await Promise.all([
    sb.from("orders").select("number, status, total, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(50),
    sb.from("user_roles").select("role_id").eq("user_id", auth.user.id),
  ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1 className="mt-2 font-display text-4xl font-bold">{auth.user.email}</h1>
        </div>
        <div className="flex gap-2">
          {roles && roles.length > 0 && <Link href="/admin" className="btn btn-accent">Panel admin</Link>}
          <form action={signOut}><button className="btn btn-ghost">Cerrar sesión</button></form>
        </div>
      </div>
      <h2 className="mt-12 font-display text-xl font-semibold">Mis pedidos</h2>
      {orders && orders.length ? (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.number} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
              <span className="font-display">{o.number}</span>
              <span className="text-smoke">{formatDate(o.created_at)}</span>
              <span>{orderStatusLabel[o.status] ?? o.status}</span>
              <span>{formatCOP(o.total)}</span>
              <Link href={`/orders/track?number=${o.number}`} className="underline">Seguimiento</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-smoke">Aún no tienes pedidos asociados a esta cuenta. Los pedidos hechos con sesión iniciada aparecen aquí.</p>
      )}
    </div>
  );
}
