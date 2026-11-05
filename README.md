# TR3S & CO. — e-commerce multimarca de calzado

Tienda online de sneakers, streetwear y calzado deportivo para TR3S & CO., Bucaramanga, Colombia (estética oscura, deportiva y premium). Tienda multimarca con inventario mixto: stock propio y referencias **bajo pedido** a proveedores, nunca sumados entre sí.

- **Tienda:** home de marca (hero, categorías Hombre/Mujer/Sneakers/Deportivo/Streetwear, destacados y novedades solo con productos reales, banner, marca, próximas colecciones), hero 3D cuando hay campaña con productos, shop con filtros por URL, búsqueda, marcas, producto con galería/zoom/360°, guía de tallas, wishlist, carrito persistente, checkout con envío por zona o cotización, **Wompi, Mercado Pago o transferencia** (PayU preparado), página privada del pedido con pago/reintento, rastreo con línea de tiempo y cuenta.
- **Panel `/admin`:** dashboard, productos y variantes, fotos, promociones reales, marcas, proveedores y confirmaciones, inventario con movimientos, pedidos con estados separados de pago/pedido/envío, pagos y eventos de webhooks, envíos manuales (zonas, tarifas, cotizaciones, transportadora y guía), clientes, contenido del inicio, campañas del hero, configuración (pasarelas, envíos, WhatsApp) y roles, auditoría.
- **Backend:** Supabase (Postgres + Auth + Storage) con RLS y funciones transaccionales para reservar stock, cobrar y cambiar estados sin sobreventa.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Three.js + React Three Fiber + drei · Framer Motion · Zustand · Zod · Supabase · Wompi · Mercado Pago · Vitest · Playwright.

## Correr en local

Requisitos: Node 20+, npm. Para la base de datos local: Docker y la CLI de Supabase (`npx supabase`).

```bash
npm install
cp .env.example .env.local     # sin variables → catálogo vacío
npm run dev                    # http://localhost:3000
```

**Modo DEMO (opcional, solo local).** Con `NEXT_PUBLIC_DEMO_CATALOG=1` y sin Supabase, la tienda muestra un catálogo de ejemplo marcado como DEMO (productos ficticios, no comprables). Por defecto está apagado: sin productos reales, la tienda muestra "catálogo oficial en preparación".

**Con base de datos local:**

```bash
npx supabase start             # levanta Postgres/Auth/Storage y aplica supabase/migrations
npx supabase status            # copia API URL, anon key y service_role key a .env.local
npm run dev
```

Crea tu usuario en `/login` y asígnate el rol admin (ver [docs/03-DESPLIEGUE.md](docs/03-DESPLIEGUE.md#4-primer-administrador)).

## Pruebas

| Comando | Qué cubre |
|---|---|
| `npm run typecheck` | Tipos TypeScript |
| `npm run lint` | ESLint (reglas de Next.js) |
| `npm test` | Unitarias: firmas Wompi, firma de webhooks de Mercado Pago, firmas PayU, referencias de reintento, disponibilidad de pasarelas, filtros, WhatsApp, validación del checkout |
| `npm run test:sql` | Reglas de negocio en Postgres: RLS, reservas, idempotencia, proveedor vencido, montos, transiciones, auditoría, **15 compradores simultáneos por la última unidad**, pasarelas, reintentos, reversos, zonas de envío, cotizaciones y despachos |
| `npm run test:e2e` | Flujo real contra `next start` + Supabase local: admin crea catálogo → compra por transferencia → confirmación, despacho, entrega y rastreo → compra bajo pedido con Wompi + webhook firmado. Más móvil: sin scroll horizontal, menú, accesibilidad básica, 404 |

`test:sql` necesita un Postgres 16 accesible (`PGHOST`, `PGPORT`, `PGUSER`). `test:e2e` necesita la app en `E2E_BASE_URL` (por defecto `http://localhost:3200`) y `psql` hacia la base local (`E2E_DATABASE_URL`).

## Documentación

- [docs/01-AUDITORIA-Y-ARQUITECTURA.md](docs/01-AUDITORIA-Y-ARQUITECTURA.md) — auditoría, arquitectura, riesgos.
- [docs/02-OPERACION.md](docs/02-OPERACION.md) — manual del panel para el equipo.
- [docs/03-DESPLIEGUE.md](docs/03-DESPLIEGUE.md) — Supabase, Vercel, Wompi, dominio, backups.

## Reglas del proyecto

- El logo de TR3S & CO. se usa tal cual, sin alterarlo.
- No se inventan productos, stock, descuentos ni testimonios: todo sale del panel.
- El contenido DEMO siempre se etiqueta y nunca se vende.
- Un modelo 3D genérico nunca representa una referencia comercial real: los productos reales usan fotos propias o un GLB autorizado.
- Los pagos se validan en el servidor (firma de integridad + webhook firmado + consulta a la pasarela). Un redireccionamiento nunca marca un pedido como pagado. No se guardan datos de tarjetas.
- Las llaves privadas solo viven en variables de entorno del servidor. `.env*` está en `.gitignore`.
