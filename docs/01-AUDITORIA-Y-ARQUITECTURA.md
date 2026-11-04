# TR3S & CO. — Fase 1: Auditoría, arquitectura y plan

Fecha: 2026-11-04

## 1. Auditoría técnica

| Punto revisado | Resultado |
|---|---|
| Repositorio del proyecto | No existe. Ninguno de los 19 repositorios de la cuenta `sebastianjaimesr` corresponde a TR3S & CO. (los más cercanos, `E-COMMERCE_Proyecto` y `emirate-scents`, son de otros proyectos y no se tocan). |
| Código existente | Ninguno. No hay funcionalidades previas que conservar. |
| Archivos de marca | El logo original y la referencia de PUMA no llegaron adjuntos. Se usa un marcador de posición tipográfico **identificado como provisional** en `public/brand/`. Se sustituye por el archivo original sin rediseñarlo. |
| Productos, proveedores, precios | No se recibieron. Todo el catálogo inicial es **DEMO**, marcado como tal y bloqueado para compra. |
| Credenciales | Ninguna (Supabase, Wompi, WhatsApp, GA4, Meta). Todo se prepara con variables de entorno y modo sandbox. |
| Modelos 3D / fotografías con licencia | Ninguno. Ver sección 3D: el hero usa un **sneaker conceptual original** generado por código, nunca presentado como una referencia comercial. |

Conclusión: proyecto nuevo (greenfield) con Next.js. No hay riesgo de borrar código útil.

## 2. Arquitectura propuesta

```
Navegador ── Next.js 15 (App Router, RSC) en Vercel
               │  páginas de tienda (server components + islas cliente)
               │  escena 3D (R3F) cargada de forma diferida, solo cliente
               │  Route Handlers: /api/checkout, /api/webhooks/wompi, /api/whatsapp
               │  Server Actions: panel /admin (con verificación de rol en servidor)
               ▼
           Supabase
               ├─ PostgreSQL (esquema relacional + RLS + funciones transaccionales)
               ├─ Auth (clientes y staff; rol en tabla `staff_roles`)
               └─ Storage (bucket `products`, `brands`, `campaigns`, `models`)
           Wompi (Web Checkout + webhook firmado + verificación por API)
           WhatsApp (enlaces wa.me con número configurado en `store_settings`)
           GA4 / Meta Pixel (solo tras consentimiento)
```

Decisiones clave:

- **Una sola fuente de verdad del stock: PostgreSQL.** La reserva de stock y la creación del pedido ocurren en una función SQL (`create_order`) dentro de una transacción con `SELECT … FOR UPDATE`, así dos clientes no pueden comprar la última unidad.
- **Inventario propio y bajo pedido separados**: tabla `inventory` (unidades físicas por variante y ubicación) y tabla `supplier_stock` (lo que reporta cada proveedor, con fecha de confirmación y tiempo de entrega). Nunca se suman. Cada ítem de pedido guarda su `fulfillment_type` (`own` / `on_order`).
- **Pedidos bajo pedido no se confirman automáticamente**: quedan en `awaiting_supplier` hasta que el staff registra la confirmación del proveedor (queda en el historial `supplier_confirmations`).
- **Pago validado solo en servidor**: la firma de integridad se calcula en el servidor; el pedido pasa a pagado solo por el webhook con checksum válido o por consulta directa a la API de Wompi. La URL de retorno nunca marca un pedido como pagado.
- **Modo DEMO sin credenciales**: si Supabase no está configurado, el catálogo lee `database/seed/demo-catalog.ts` (productos marcados DEMO). El checkout y el admin muestran qué falta configurar en vez de simular.
- **Animación**: Framer Motion para UI y scroll (`useScroll`), R3F `useFrame` para 3D. Se descarta GSAP/ScrollTrigger para no duplicar dos motores de animación.

## 3. Experiencia 3D

- Hero: `Canvas` de React Three Fiber, cargado con `next/dynamic` (sin SSR) tras pintar el contenido comercial. Luz de estudio con `Environment` + `Lightformer` (sin descargar HDRIs externos), `ContactShadows`, rotación suave, parallax con el cursor y arrastre táctil.
- Producto con `model_url` (GLB autorizado, comprimido con Draco/Meshopt) → se carga ese modelo.
- Producto sin modelo → se muestra su fotografía real con transición; **no se finge un 3D**.
- Productos DEMO → sneaker conceptual original de TR3S construido por código, con la paleta del producto demo. Nunca representa un modelo comercial real.
- Detección: sin WebGL, con `prefers-reduced-motion` o en equipos de gama baja se reduce DPR, se apagan sombras/rotación o se usa imagen estática.
- "THE TR3S EXPERIENCE": boutique 3D que solo se monta cuando entra en pantalla.

## 4. Estructura de carpetas

```
app/
  (store)/            tienda pública (home, shop, men, women, …, checkout, account)
  admin/              panel protegido
  api/                route handlers (checkout, webhooks, health)
  sitemap.ts robots.ts
components/           UI genérica (header, footer, botones, logo)
features/
  three/              escenas 3D (hero, sneaker conceptual, boutique)
  home/               hero, carrusel, storytelling
  catalog/            grid, filtros, tarjeta, página de producto
  cart/ wishlist/     estado cliente (zustand) + vistas
  checkout/           formulario y resumen
  admin/              vistas y formularios del panel
lib/                  utilidades (formato COP, env, supabase clients, seo)
services/             acceso a datos (catalog, orders, inventory, suppliers, payments/wompi, whatsapp)
validations/          esquemas zod compartidos cliente/servidor
types/                tipos de dominio
supabase/
  migrations/         SQL (tablas, índices, RLS, funciones, storage) — aplicables con `supabase db push`
  config.toml         stack local de Supabase
database/
  seed/               catálogo DEMO
  test-support/       stubs para correr las pruebas SQL en Postgres plano
tests/                unitarios (vitest), SQL y e2e (playwright)
public/brand/         logo original de TR3S & CO. (sin alterar)
docs/
```

## 5. Plan de implementación

| Fase | Entrega | Depende de ti |
|---|---|---|
| 2 Diseño visual | tokens, tipografía, header, hero, carrusel, páginas | logo original |
| 3 3D | escena hero, sincronía carrusel↔hero, boutique, fallbacks | modelos GLB autorizados (opcional) |
| 4 E-commerce | shop + filtros, producto, búsqueda, wishlist, carrito, checkout | — |
| 5 Backend | esquema SQL, RLS, auth, roles, inventario mixto, pedidos | proyecto Supabase |
| 6 Admin | dashboard, productos, marcas, proveedores, inventario, pedidos, clientes, campañas | — |
| 7 Integraciones | WhatsApp, Wompi sandbox, Storage, GA4/Meta con consentimiento | número WhatsApp, llaves Wompi test |
| 8 Pruebas | unitarias, SQL (concurrencia de stock), e2e, responsive, a11y | — |
| 9 Producción | guía Vercel + Supabase + dominio | dominio, llaves de producción |

## 6. Dependencias

Producción: `next@15`, `react@19`, `tailwindcss@4`, `three`, `@react-three/fiber@9`, `@react-three/drei@10`, `framer-motion`, `zustand`, `zod`, `@supabase/supabase-js`, `@supabase/ssr`, `clsx`.
Desarrollo: `typescript`, `vitest`, `@playwright/test`, `eslint`.
Servicios: Supabase (plan gratuito suficiente al inicio), Vercel (Hobby/Pro), Wompi (sin mensualidad, comisión por transacción).

Costo fijo estimado al arrancar: $0 COP/mes en planes gratuitos + dominio (~$50.000–$90.000 COP/año). Compatible con el capital de $2–5 M COP.

## 7. Riesgos

Técnicos
- **Peso del 3D en móviles de gama media** (mercado colombiano). Mitigación: carga diferida, DPR limitado, sin sombras en móvil, fallback de imagen.
- **Sobreventa entre canales** (Instagram/WhatsApp venden la misma unidad que la web). Mitigación: toda venta, incluida la de WhatsApp, se registra como movimiento de inventario en el admin.
- **Stock de proveedor desactualizado**. Mitigación: fecha de última confirmación visible para el staff; los pedidos bajo pedido requieren confirmación manual antes de despachar.
- **Webhook de Wompi perdido**. Mitigación: verificación adicional por API desde el admin y al volver del checkout.
- **Plan gratuito de Supabase pausa proyectos inactivos**. Mitigación: pasar a Pro cuando haya ventas o programar actividad.

Comerciales y legales
- **Uso de marcas de terceros** (Nike, Adidas…): se pueden nombrar para describir productos legítimos, pero no usar sus logos como identidad ni afirmar distribución oficial. El sitio incluye aviso de tienda multimarca independiente.
- **Fotografías**: solo propias o autorizadas por el proveedor. Las imágenes de Google no se pueden usar.
- **Autenticidad**: el comprador colombiano desconfía de réplicas; conviene documentar la procedencia de cada lote.
- **Ley 1581 de 2012 (datos personales) y Estatuto del Consumidor (Ley 1480, derecho de retracto)**: políticas incluidas como borrador para revisión de un abogado.
- **Capital limitado**: el modelo bajo pedido evita inmovilizar inventario, pero alarga entregas; los plazos se muestran siempre al cliente.
