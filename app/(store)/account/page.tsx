import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/features/account/auth-actions";
import { formatCOP, formatDate } from "@/lib/format";
import { orderStatusLabel, orderTone, paymentStatusLabel, paymentTone, shipmentStatusLabel, type Tone } from "@/features/account/status";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };
export const dynamic = "force-dynamic";

/* Every query runs with the customer's own session: RLS only returns their rows. */
export default async function AccountPage() {
  const sb = await supabaseServer();
  if (!sb) redirect("/login");
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/login?next=/account");
  const [{ data: orders }, { data: roles }, { data: customer }] = await Promise.all([
    sb
      .from("orders")
      .select("number, status, payment_status, total, created_at, access_token, shipments(status)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("user_roles").select("role_id").eq("user_id", auth.user.id),
    sb.from("customers").select("first_name, last_name, phone, city, department, address").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  const shipStatus = (s: unknown) => (Array.isArray(s) ? (s[0] as { status: string } | undefined)?.status : (s as { status: string } | null)?.status) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <div className="min-w-0">
          <p className="eyebrow">Mi cuenta</p>
          <h1 className="mt-2 truncate font-display text-3xl font-bold md:text-5xl">{customer ? `Hola, ${customer.first_name}` : auth.user.email}</h1>
          {customer && <p className="mt-1 text-sm text-smoke">{auth.user.email}</p>}
        </div>
        <div className="flex gap-2">
          {roles && roles.length > 0 && <Link href="/admin" className="btn btn-accent">Panel admin</Link>}
          <form action={signOut}><button className="btn btn-ghost">Cerrar sesión</button></form>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <h2 className="font-display text-xl font-semibold">Mis pedidos</h2>
          {orders && orders.length ? (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => {
                const ss = shipStatus(o.shipments);
                return (
                  <li key={o.number}>
                    <Link href={`/checkout/result?order=${encodeURIComponent(o.number)}&t=${o.access_token}`} className="group block border border-line bg-coal p-5 transition-colors hover:border-paper/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display text-lg">{o.number}</span>
                        <span className="font-display">{formatCOP(o.total)}</span>
                      </div>
                      <p className="mt-1 text-xs text-smoke">{formatDate(o.created_at)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Chip tone={paymentTone(o.payment_status)}>{paymentStatusLabel[o.payment_status] ?? o.payment_status}</Chip>
                        <Chip tone={orderTone(o.status)}>{orderStatusLabel[o.status] ?? o.status}</Chip>
                        {ss && <Chip tone="muted">Envío: {shipmentStatusLabel[ss] ?? ss}</Chip>}
                      </div>
                      <span className="mt-3 inline-block text-xs text-bone/70 underline-offset-4 group-hover:underline">Ver detalle →</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 border border-line p-8 text-center">
              <p className="font-display text-lg">Aún no tienes pedidos</p>
              <p className="mt-2 text-sm text-smoke">Los pedidos que hagas con tu sesión iniciada aparecerán aquí con su estado de pago y envío.</p>
              <Link href="/shop" className="btn btn-primary mt-6">Ir a la tienda</Link>
            </div>
          )}
        </section>
        <aside className="lg:col-span-4">
          <h2 className="font-display text-xl font-semibold">Mis datos</h2>
          <div className="mt-4 border border-line p-5 text-sm">
            {customer ? (
              <dl className="space-y-2">
                <div><dt className="eyebrow">Nombre</dt><dd>{customer.first_name} {customer.last_name}</dd></div>
                <div><dt className="eyebrow">Celular</dt><dd>{customer.phone}</dd></div>
                {customer.address && <div><dt className="eyebrow">Última dirección</dt><dd>{customer.address}, {customer.city}, {customer.department}</dd></div>}
              </dl>
            ) : (
              <p className="text-smoke">Guardamos tus datos de entrega cuando haces tu primer pedido con la sesión iniciada.</p>
            )}
            <p className="mt-4 text-xs text-smoke">
              Para corregir o eliminar tus datos escríbenos (Ley 1581 de 2012). <Link href="/policies/privacidad" className="underline">Política de datos</Link>
            </p>
          </div>
          <Link href="/orders/track" className="btn btn-ghost mt-4 w-full">Rastrear un pedido</Link>
        </aside>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return (
    <span
      className={cn(
        "border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
        tone === "ok" && "border-emerald-500/40 text-emerald-300",
        tone === "warn" && "border-amber-300/40 text-amber-300",
        tone === "bad" && "border-crimson/60 text-crimson",
        tone === "muted" && "border-line text-smoke",
      )}
    >
      {children}
    </span>
  );
}
