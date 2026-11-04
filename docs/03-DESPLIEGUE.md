# 03 — Despliegue a producción

Guía para publicar TR3S & CO. con **Supabase** (base de datos, usuarios y fotos) y **Vercel** (la web). Ambos tienen plan gratuito suficiente para empezar; el costo real inicial es el dominio y, cuando crezcan las ventas, Supabase Pro (≈ USD 25/mes) por los backups diarios.

Orden recomendado: Supabase → Vercel → primer admin → configuración de la tienda → Wompi en pruebas → catálogo real → Wompi producción → dominio.

## 1. Supabase

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo:
   - Región: **East US (North Virginia)** o **São Paulo** (las más cercanas a Colombia).
   - Guarda la contraseña de la base de datos en un gestor de contraseñas.
2. Aplica las migraciones del repositorio (crean tablas, funciones, RLS y buckets de fotos):

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push            # aplica supabase/migrations/*.sql en orden
   ```

   Alternativa sin CLI: en **SQL Editor**, ejecuta los 4 archivos de `supabase/migrations/` en orden numérico.
3. **Authentication → URL Configuration:**
   - *Site URL*: `https://tu-dominio.com`
   - *Redirect URLs*: `https://tu-dominio.com/auth/callback` y, mientras pruebas, `https://*.vercel.app/auth/callback`.
4. **Authentication → Providers → Email:** deja activado *Confirm email* en producción. Para correos con tu dominio configura SMTP propio en *Authentication → SMTP* (el SMTP incluido de Supabase tiene un límite muy bajo por hora).
5. **Project Settings → API:** copia `Project URL`, `anon public` y `service_role`. La `service_role` es secreta: solo va en Vercel, nunca en el código ni en el navegador.

## 2. Vercel

1. En <https://vercel.com>, *Add New → Project* e importa el repositorio de GitHub. Framework: Next.js (se detecta solo).
2. En *Settings → Environment Variables* agrega (ver `.env.example`):

   | Variable | Valor | Entornos |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio.com` (sin `/` final) | Production |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | todos |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public | todos |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role | todos (**secreta**) |
   | `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | `pub_test_…` → luego `pub_prod_…` | todos |
   | `WOMPI_INTEGRITY_SECRET` | `test_integrity_…` → luego `prod_integrity_…` | todos (**secreta**) |
   | `WOMPI_EVENTS_SECRET` | `test_events_…` → luego `prod_events_…` | todos (**secreta**) |
   | `WOMPI_ENV` | `sandbox` → luego `production` | todos |
   | `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID` | opcionales | Production |

3. *Deploy*. Cada cambio de variables necesita un nuevo deploy (*Deployments → Redeploy*).

## 3. Dominio

*Vercel → Settings → Domains* → agrega `tu-dominio.com` y `www.tu-dominio.com`, y crea en tu proveedor DNS los registros que Vercel indique (A `76.76.21.21` para el raíz y CNAME `cname.vercel-dns.com` para `www`). El certificado HTTPS es automático. Luego actualiza `NEXT_PUBLIC_SITE_URL` y la *Site URL* de Supabase.

## 4. Primer administrador

1. Entra a `https://tu-dominio.com/login` → *Crear cuenta* con el correo del dueño, y confírmalo.
2. En Supabase → *SQL Editor*:

   ```sql
   insert into public.user_roles (user_id, role_id)
   select id, 'admin' from auth.users where email = 'correo-del-dueno@ejemplo.com';
   ```

3. Desde ese momento, el resto del equipo se gestiona en `/admin/settings` → *Roles*:
   - **admin**: todo (configuración, campañas, promociones, roles, auditoría).
   - **sales**: pedidos, pagos por transferencia, despachos, clientes.
   - **inventory**: productos, fotos, variantes, marcas, inventario y proveedores.

   La persona debe haber creado su cuenta en `/login` antes de asignarle un rol.

## 5. Configuración de la tienda (en `/admin/settings`)

- Número de **WhatsApp Business** (formato `573001234567`). Si está vacío, los botones de WhatsApp no aparecen.
- Tarifa de envío fija y, opcional, envío gratis desde cierto monto.
- **Instrucciones de transferencia**: banco, tipo y número de cuenta, titular. Se muestran al cliente al terminar el pedido.
- Métodos de pago habilitados, vigencia de confirmaciones de proveedor (días) y umbral de stock bajo.
- Revisa y ajusta con un abogado los textos de `lib/policies.ts` (envíos, cambios, garantías, privacidad, términos) antes de vender. Son un borrador basado en la Ley 1480 de 2011 y la Ley 1581 de 2012.

## 6. Wompi

1. Crea la cuenta de comercio en <https://comercios.wompi.co> y completa la verificación.
2. *Desarrolladores → Llaves*: copia las llaves de **pruebas** (pública, integridad y eventos) a Vercel con `WOMPI_ENV=sandbox`.
3. *Desarrolladores → URL de eventos*: `https://tu-dominio.com/api/webhooks/wompi` (configúrala tanto en pruebas como en producción).
4. Haz compras de prueba con los datos de prueba de Wompi (tarjeta aprobada y rechazada, Nequi, PSE). Verifica en `/admin/orders` que:
   - la aprobada pasa a *En preparación* (o *Esperando proveedor* si lleva ítems bajo pedido);
   - la rechazada queda registrada en el historial y el pedido sigue pendiente para que el cliente reintente; si no paga en 60 minutos, el pedido se cancela y el stock se libera.
5. Para salir a producción, reemplaza las tres llaves por las de producción y cambia `WOMPI_ENV=production`. Redeploy.

**Cómo se valida un pago:**
- El monto y la referencia van firmados (firma de integridad SHA-256) para que no se puedan alterar en el navegador.
- El webhook verifica el checksum del evento con el secreto de eventos y descarta repeticiones.
- La página de resultado consulta la transacción directamente a Wompi.
- Si el monto pagado no coincide con el pedido, o el pago llega después de vencida la reserva, el pedido queda en **Incidencia** para revisión humana.
- No se almacenan datos de tarjetas.

## 7. Reservas vencidas

Los pedidos sin pagar reservan el stock 60 minutos (Wompi) o 48 horas (transferencia). Las reservas vencidas se liberan automáticamente cada vez que alguien crea un pedido. Si quieres liberarlas también en horas sin ventas, en Supabase → *Database → Cron* (extensión `pg_cron`) crea un job cada 15 minutos:

```sql
select cron.schedule('expire-reservations', '*/15 * * * *', $$select public.expire_reservations()$$);
```

## 8. Fotos y modelos 3D

- Las fotos se suben desde `/admin/products/<id>` (JPG/PNG/WEBP/AVIF, máx. 5 MB) y quedan en Supabase Storage.
- Usa solo fotos propias o con licencia del proveedor o marca. No uses imágenes tomadas de Google.
- Un modelo 3D (`.glb`) solo debe asociarse a un producto si representa **esa** referencia y tienes autorización para usarlo. Súbelo al bucket `models` (máx. 15 MB, ideal < 5 MB con compresión Draco/meshopt) y pega su URL pública en el campo *Modelo 3D* del producto o de la campaña.

## 9. Backups y continuidad

- **Plan gratuito de Supabase:** no incluye backups descargables. Haz un respaldo semanal manual:

  ```bash
  npx supabase db dump --linked -f backup-$(date +%F).sql
  npx supabase db dump --linked --data-only -f datos-$(date +%F).sql
  ```

  Guárdalo fuera de tu computador (Drive o similar, con acceso restringido).
- **Supabase Pro:** backups diarios automáticos con 7 días de retención; recomendado desde que haya ventas reales.
- Las fotos de Storage no entran en el dump: conserva los originales en una carpeta propia.
- Vercel guarda cada deploy; *Deployments → Promote to Production* revierte a una versión anterior en segundos.

## 10. Lista de verificación antes de abrir

- [ ] Migraciones aplicadas y primer admin creado.
- [ ] Configuración completa: WhatsApp, envío, transferencia, métodos de pago.
- [ ] Productos reales con fotos, variantes y stock o proveedor confirmado. Al conectar Supabase el catálogo DEMO desaparece solo.
- [ ] Campaña del hero creada en `/admin/campaigns` con productos reales.
- [ ] Políticas revisadas por un abogado; NIT y razón social en el footer o en `lib/site.ts`.
- [ ] Wompi probado en sandbox (aprobada, rechazada, webhook) y luego en producción con una compra real pequeña.
- [ ] Dominio con HTTPS; `NEXT_PUBLIC_SITE_URL` y la *Site URL* de Supabase actualizadas.
- [ ] Google Search Console con `https://tu-dominio.com/sitemap.xml`.
- [ ] Pruebas en verde: `npm run typecheck && npm run lint && npm test && npm run test:sql && npm run test:e2e`.

## 11. Pruebas end-to-end en local

```bash
npx supabase start
# .env.local con las llaves locales de `npx supabase status` y, para Wompi, valores de prueba
# (por ejemplo pub_test_local / test_integrity_local / test_events_local, WOMPI_ENV=sandbox)
npm run build && npx next start -p 3200 &
E2E_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
WOMPI_EVENTS_SECRET=<el mismo de .env.local> npm run test:e2e
```

La prueba no contacta a Wompi: intercepta la redirección al checkout y envía al webhook un evento firmado con el secreto de pruebas.
