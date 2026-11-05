# TR3S & CO. — Rediseño 3D (entrega A)

## Qué cambia

| Área | Cambio |
|---|---|
| Paleta | Rojo de marca `#D50025` (`crimson`), rojo profundo `#8C0019` (`wine`), grises metálicos `metal` `#A8ADB5` y `steel` `#5C6169`. Negro `#050505` y blanco sin cambios. |
| Hero | El eslogan TU ESTILO. / TU ESENCIA. (contorno) / TU CAMINO. (rojo) sobre rayas diagonales se conserva. A la derecha (debajo en móvil) aparece **TR3S CONCEPT 001**, un sneaker 3D original construido por código, con flotación, luz cinematográfica, halo rojo, partículas, rotación con mouse/arrastre táctil y tres colores (Esencia, Estilo, Visaje). Al hacer scroll el modelo gira, sube y la cámara se acerca; los textos salen a distinta velocidad (profundidad). |
| Manifiesto | Nueva sección ESENCIA · ESTILO · VISAJE. En escritorio se fija en pantalla y cada palabra toma protagonismo con el scroll; en móvil y con movimiento reducido es una lista normal. |
| Home | Rieles: Nuevos lanzamientos, Sneakers destacados, Ofertas, Hombre, Mujer y Más vendidos. **Cada riel solo aparece si tiene productos reales**; con el catálogo vacío se ve un único bloque "Catálogo oficial en preparación". |
| Newsletter | Formulario con consentimiento explícito (Ley 1581), honeypot y límite de intentos. Lista en `/admin/newsletter`. |
| UX | Transición suave entre páginas, anillo de cursor en escritorio (el cursor nativo no se oculta), notificaciones (favoritos, newsletter) y skeletons de carga para catálogo y producto. |

## Decisiones

- **El sneaker del hero no es un producto.** Es un diseño propio de TR3S (`features/three/ConceptSneaker.tsx`), siempre rotulado "Diseño 3D original · No es un producto a la venta", sin precio ni botón de compra. No se usaron modelos de marcas reales.
- **GSAP + ScrollTrigger** controla solo lo ligado al scroll (hero y manifiesto). Framer Motion sigue para componentes (carrito, toasts, transiciones). GSAP se carga solo donde se usa.
- **Rendimiento:** el titular se pinta en el servidor (LCP) y el 3D se monta cuando el navegador está libre (`requestIdleCallback`). En equipos de gama baja: DPR ≤ 1.25, sin sombras ni antialias y menos partículas. Sin WebGL se muestra la composición con el logo oficial. Con `prefers-reduced-motion` no hay flotación, giro automático, scroll animado ni cursor.
- **Más vendidos** sale de `best_selling_products()`: suma unidades de pedidos con pago aprobado (90 días) y solo expone ids de producto y unidades.

## Base de datos

Migración `supabase/migrations/20261105000002_newsletter_bestsellers.sql` (solo agrega):

- Tabla `newsletter_subscribers` con RLS: solo admin/ventas la leen; el público no tiene acceso directo.
- `subscribe_newsletter(email, source)`: alta idempotente que no revela si el correo ya existía.
- `best_selling_products(limit, days)`.

Pruebas: `tests/sql/03_newsletter_bestsellers.sql`.

## Cómo integrar modelos 3D reales (GLB)

1. Consigue un modelo **autorizado** por la marca o el proveedor (no descargues modelos de terceros sin licencia).
2. Optimízalo (objetivo ≤ 3 MB):
   ```bash
   npx @gltf-transform/cli optimize entrada.glb salida.glb --compress meshopt --texture-compress webp --texture-size 2048
   ```
3. Revisa que el zapato esté centrado, con la punta hacia +X y apoyado en y≈0 (la escena lo escala sola).
4. Súbelo al bucket `models` de Supabase Storage y pega la URL pública en el campo **Modelo 3D autorizado (URL .glb)** del producto en `/admin/products`.
5. El visor 360° de la página de producto lo carga automáticamente (`features/three/ProductViewer.tsx`, con zoom y arrastre). Si el producto no tiene GLB, se muestran sus fotos; nunca se finge un 3D.

Cambiar el concepto del hero (colores o textos): `features/home/HeroStage.tsx` (`conceptColorways`).
