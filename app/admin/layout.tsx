import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getStaff, can, type Role } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { signOut } from "@/features/account/auth-actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin TR3S" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const nav: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin", label: "Dashboard", roles: [] },
  { href: "/admin/orders", label: "Pedidos", roles: ["sales", "inventory"] },
  { href: "/admin/payments", label: "Pagos", roles: ["sales"] },
  { href: "/admin/shipping", label: "Envíos", roles: ["sales"] },
  { href: "/admin/products", label: "Productos", roles: ["inventory"] },
  { href: "/admin/inventory", label: "Inventario", roles: ["inventory", "sales"] },
  { href: "/admin/suppliers", label: "Proveedores", roles: ["inventory", "sales"] },
  { href: "/admin/brands", label: "Marcas", roles: ["inventory"] },
  { href: "/admin/customers", label: "Clientes", roles: ["sales"] },
  { href: "/admin/newsletter", label: "Newsletter", roles: ["sales"] },
  { href: "/admin/home", label: "Contenido del inicio", roles: ["admin"] },
  { href: "/admin/campaigns", label: "Campañas", roles: ["admin"] },
  { href: "/admin/settings", label: "Configuración", roles: ["admin"] },
  { href: "/admin/audit", label: "Auditoría", roles: ["admin"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Logo size={96} />
        <h1 className="mt-8 font-display text-3xl font-bold">Panel administrativo</h1>
        <p className="mt-4 text-bone/80">El panel necesita una base de datos. Para activarlo:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-bone/80">
          <li>Crea un proyecto en Supabase y ejecuta los archivos de <code>supabase/migrations</code> en orden (o <code>npx supabase db push</code>).</li>
          <li>Configura <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
          <li>Crea tu usuario en /login y asígnate el rol admin con el SQL de <code>docs/03-DESPLIEGUE.md</code>.</li>
        </ol>
      </main>
    );
  }
  const staff = await getStaff();
  if (!staff) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">Acceso restringido</h1>
        <p className="mt-4 text-smoke">Ingresa con una cuenta del equipo TR3S & CO. que tenga rol asignado.</p>
        <Link href="/login?next=/admin" className="btn btn-primary mt-8">Ingresar</Link>
      </main>
    );
  }
  return (
    <div className="min-h-[100svh] bg-ink lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-coal lg:sticky lg:top-0 lg:h-[100svh] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 p-4">
          <Logo size={44} href="/admin" />
          <div className="text-xs">
            <p className="font-display font-semibold tracking-[0.15em]">ADMIN</p>
            <p className="truncate text-smoke">{staff.roles.join(" · ")}</p>
          </div>
        </div>
        <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
          {nav.filter((n) => !n.roles.length || can(staff, n.roles)).map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap px-3 py-2 text-sm text-bone/80 hover:bg-graphite hover:text-paper">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden space-y-2 p-4 text-xs text-smoke lg:block">
          <p className="truncate">{staff.email}</p>
          <Link href="/" className="block hover:text-paper">← Ver tienda</Link>
          <form action={signOut}><button className="hover:text-paper">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
