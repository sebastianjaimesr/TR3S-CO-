import { requireStaff } from "@/lib/auth";
import { PageHeader, Flash, Field, TextArea, Check, Select, Table, Td } from "@/features/admin/ui";
import { grantRole, revokeRole, saveSettings } from "@/features/admin/actions/operations";
import { supabaseService } from "@/lib/supabase/server";
import { isWompiConfigured, serverEnv } from "@/lib/env";

export default async function SettingsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaff(["admin"]);
  const [{ data: s }, { data: roles }] = await Promise.all([
    staff.sb.from("store_settings").select("*").eq("id", 1).single(),
    staff.sb.from("user_roles").select("user_id, role_id, created_at").order("created_at"),
  ]);
  const svc = supabaseService();
  const users = svc ? (await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })).data?.users ?? [] : [];
  const emailOf = (id: string) => users.find((u) => u.id === id)?.email ?? id;
  return (
    <>
      <PageHeader title="Configuración" eyebrow="Tienda" />
      <Flash sp={await searchParams} />
      <form action={saveSettings} className="grid gap-4 md:grid-cols-2">
        <Field label="WhatsApp Business (con indicativo)" name="whatsapp_number" defaultValue={s?.whatsapp_number} placeholder="573001234567" hint="Se usa en todos los botones de WhatsApp. Vacío = botones ocultos." />
        <Field label="Correo de contacto" name="contact_email" type="email" defaultValue={s?.contact_email} />
        <Field label="Teléfono visible" name="contact_phone" defaultValue={s?.contact_phone} />
        <Field label="Dirección / ciudad" name="address" defaultValue={s?.address} />
        <Field label="Instagram (URL)" name="instagram_url" defaultValue={s?.instagram_url} />
        <Field label="TikTok (URL)" name="tiktok_url" defaultValue={s?.tiktok_url} />
        <Field label="Envío tarifa fija (COP)" name="shipping_flat_rate" type="number" defaultValue={s?.shipping_flat_rate} />
        <Field label="Envío gratis desde (COP, opcional)" name="free_shipping_from" type="number" defaultValue={s?.free_shipping_from} />
        <Field label="Vigencia de confirmación de proveedor (días)" name="supplier_confirmation_max_age_days" type="number" defaultValue={s?.supplier_confirmation_max_age_days} />
        <Field label="Umbral de stock bajo" name="low_stock_threshold" type="number" defaultValue={s?.low_stock_threshold} />
        <TextArea label="Instrucciones de transferencia (banco, tipo y número de cuenta, titular)" name="bank_transfer_instructions" defaultValue={s?.bank_transfer_instructions} className="md:col-span-2" />
        <div className="flex flex-wrap gap-6 md:col-span-2">
          <Check label={`Pagos con Wompi ${isWompiConfigured() ? `(${serverEnv().wompiEnv})` : "(faltan llaves)"}`} name="payment_wompi_enabled" defaultChecked={s?.payment_wompi_enabled} />
          <Check label="Transferencia bancaria" name="payment_transfer_enabled" defaultChecked={s?.payment_transfer_enabled} />
        </div>
        <button className="btn btn-primary md:w-fit">Guardar configuración</button>
      </form>

      <section className="mt-14">
        <h2 className="mb-3 font-display text-lg font-semibold">Equipo y roles</h2>
        <p className="mb-4 text-sm text-smoke">Administrador: todo. Ventas: pedidos, pagos, despachos y clientes. Inventario: productos, stock y proveedores.</p>
        <Table head={["Usuario", "Rol", ""]} empty={!roles?.length}>
          {roles?.map((r) => (
            <tr key={r.user_id + r.role_id}>
              <Td>{emailOf(r.user_id)}</Td>
              <Td>{r.role_id}</Td>
              <Td>
                <form action={revokeRole}>
                  <input type="hidden" name="user_id" value={r.user_id} />
                  <input type="hidden" name="role" value={r.role_id} />
                  <button className="text-xs text-crimson underline">Revocar</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
        <form action={grantRole} className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Correo del usuario (ya registrado)" name="email" type="email" required />
          <Select label="Rol" name="role" options={[{ value: "sales", label: "Ventas" }, { value: "inventory", label: "Inventario" }, { value: "admin", label: "Administrador" }]} />
          <button className="btn btn-ghost h-12 self-end">Asignar rol</button>
        </form>
      </section>
    </>
  );
}
