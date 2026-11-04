# TR3S & CO. — e-commerce multimarca de calzado

Tienda online inmersiva (3D) para TR3S & CO., Bucaramanga, Colombia. Tienda multimarca con inventario mixto: stock propio y referencias **bajo pedido** a proveedores, nunca sumados entre sí.

- **Tienda:** home con hero 3D sincronizado con carrusel, storytelling, *THE TR3S EXPERIENCE*, shop con filtros por URL, búsqueda, marcas, producto con galería/zoom/360°, guía de tallas, wishlist, carrito, checkout (Wompi o transferencia), seguimiento de pedido y cuenta.
- **Panel `/admin`:** dashboard, productos y variantes, fotos, promociones reales, marcas, proveedores y confirmaciones, inventario con movimientos, pedidos (pago, proveedor, despacho, estados), clientes, campañas del hero, configuración (WhatsApp, envíos, pagos) y roles, auditoría.
- **Backend:** Supabase (Postgres + Auth + Storage) con RLS y funciones transaccionales para reservar stock, cobrar y cambiar estados sin sobreventa.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Three.js + React Three Fiber + drei · Framer Motion · Zustand · Zod · Supabase · Wompi · Vitest · Playwright.

## Correr en local

Requisitos: Node 20+, npm. Para la base de datos local: Docker y la CLI de Supabase (`npx supabase`).

```bash
npm install
cp .env.example .env.local     # sin variables → MODO DEMO
npm run dev                    # http://localhost:3000
```

**Modo DEMO.** Sin Supabase la tienda muestra un catálogo de ejemplo marcado como DEMO (marcas y productos ficticios, renders conceptuales). Nada de eso se puede comprar.

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
| `npm test` | Unitarias: firmas Wompi, filtros, disponibilidad, WhatsApp, validación del checkout |
| `npm run test:sql` | Reglas de negocio en Postgres: RLS, reservas, idempotencia, proveedor vencido, montos, transiciones, auditoría y **15 compradores simultáneos por la última unidad** |
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
- Los pagos se validan en el servidor (firma de integridad + webhook con checksum + consulta a Wompi). No se guardan datos de tarjetas.
- Las llaves privadas solo viven en variables de entorno del servidor. `.env*` está en `.gitignore`.
