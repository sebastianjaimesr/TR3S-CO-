# TR3S & CO. — Rediseño visual (entrega A)

> **Actualización 2026-11-05 · Realismo antes que efectos.** Por directiva de la marca, el sneaker 3D generado por código se retiró del hero. Las tiendas muestran **fotografías reales** de cada producto; el 3D solo aparece cuando existe el **GLB oficial** de esa referencia. El modelo conceptual (`ConceptSneaker`) queda únicamente para el catálogo DEMO de desarrollo y siempre rotulado como tal.

## Fotografía de producto

- **Hero:** muestra la foto principal de un producto real (destacado primero, luego el más nuevo) sobre un panel de estudio claro, con flotación sutil e inclinación con el cursor. Sin productos fotografiados, se ve la composición con el logo oficial (nunca un zapato inventado).
- **Tarjetas:** fondo de estudio `#ECECEC` (combina con fotos de fondo blanco o gris), zoom suave y cambio a la segunda foto al pasar el cursor.
- **Galería:** foto grande con lupa al pasar el cursor, deslizamiento en móvil, pantalla completa con flechas y teclado, y la vista (lateral, suela…) como pie de foto.
- **Admin (`/admin/products/[id]`):** se suben varias fotos a la vez directamente a Supabase Storage (sin el límite de 4.5 MB de Vercel). Cada foto se etiqueta con su vista y la galería se ordena sola: lateral → medial → frontal → trasera → superior → suela → detalle → lifestyle. Si una foto pesa más de 5 MB o mide más de 2800 px se optimiza a WEBP en el navegador; si mide menos de 1600 px se avisa que se verá menos nítida.
- **Guía de fotos:** fondo blanco o gris claro uniforme, luz de estudio suave (caja de luz grande arriba + rebotes laterales), cámara a la altura del zapato, mínimo 2000 px en el lado largo, sin filtros. Solo fotos propias o autorizadas por el proveedor.

## Visor 360° con GLB oficial

`features/three/ProductViewer.tsx`: materiales PBR tal como vienen en el GLB (albedo, normal, roughness/metalness, AO), entorno de estudio con softboxes, tone mapping AgX, sombra de piso acumulada (físicamente suave), rotación 360°, zoom con rueda o pellizco. El GLB se sube desde el admin (bucket `models`, máx. 15 MB).

---

## Historial: primera versión de la entrega A

## Qué cambia

| Área | Cambio |
|---|---|
| Paleta | Rojo de marca `#D50025` (`crimson`), rojo profundo `#8C0019` (`wine`), grises metálicos `metal` `#A8ADB5` y `steel` `#5C6169`. Negro `#050505` y blanco sin cambios. |
| Hero (retirado el 3D) | El eslogan TU ESTILO. / TU ESENCIA. (contorno) / TU CAMINO. (rojo) sobre rayas diagonales se conserva. A la derecha (debajo en móvil) aparece **TR3S CONCEPT 001**, un sneaker 3D original construido por código, con flotación, luz cinematográfica, halo rojo, partículas, rotación con mouse/arrastre táctil y tres colores (Esencia, Estilo, Visaje). Al hacer scroll el modelo gira, sube y la cámara se acerca; los textos salen a distinta velocidad (profundidad). |
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
