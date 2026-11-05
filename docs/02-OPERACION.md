# 02 — Manual del panel (`/admin`)

Para el equipo de TR3S & CO. Cada persona ve solo las secciones de su rol: **admin** (todo), **sales** (ventas) e **inventory** (catálogo e inventario). Todo cambio queda en *Auditoría* con quién y cuándo.

## Publicar un producto (inventory)

1. **Marcas:** crea la marca si no existe. Registra solo marcas que vendes legítimamente y no digas que eres distribuidor oficial si no lo eres.
2. **Productos → Nuevo:**
   - Llena nombre, referencia, marca, categoría, género, tipo, descripción, materiales y precio en pesos.
   - Usa *Precio anterior* solo si el producto realmente se vendió a ese precio. Si no, déjalo vacío.
   - Guarda sin marcar *Publicado*.
3. En la ficha del producto:
   - **Variantes:** usa *Crear variantes* con color y tallas (ej: `38, 39, 40`). El SKU se genera como `REFERENCIA-COLOR-TALLA`.
   - **Fotografías:** sube fotos propias o autorizadas (JPG/PNG/WEBP/AVIF, máx. 5 MB) con texto alternativo. La primera es la principal.
   - El aviso amarillo de la ficha te dice qué falta (fotos, variantes o stock).
4. Agrega stock (siguiente sección) y marca **Publicado**.

Si un producto no tiene foto, la tienda muestra *Foto en producción*. Nunca se reemplaza por la imagen de otro zapato.

## Inventario propio (inventory)

En **Inventario** registra cada movimiento por SKU:

- **Entrada:** compra a proveedor. Indica cantidad y costo unitario.
- **Salida:** venta en tienda física, daño o pérdida.
- **Ajuste:** corrección de conteo, positiva o negativa.

El inventario nunca se edita a mano: cada cambio deja un movimiento con nota. Las ventas online reservan stock al crear el pedido y lo descuentan al confirmarse el pago.

## Bajo pedido con proveedores (inventory / sales)

1. **Proveedores → Crear proveedor** con sus datos y condiciones.
2. En la ficha del proveedor, en **Vincular**, ingresa:
   - el SKU de TR3S;
   - el SKU del proveedor y su costo;
   - la cantidad que reporta y los días de entrega.
3. La tienda vende esa talla como **Bajo pedido · N días** solo si la confirmación está vigente (por defecto 7 días, configurable).
4. Cuando la confirmación vence, la talla deja de venderse. Para reactivarla:
   - pregúntale al proveedor;
   - pulsa **OK** en la fila con la cantidad confirmada.
5. El stock del proveedor **nunca se suma** al propio. Si hay stock propio, se vende primero ese.

## Pedidos (sales)

Cada pedido tiene **tres estados independientes**: pago, pedido y envío.

| Estado del pedido | Qué significa | Qué hacer |
|---|---|---|
| Pendiente de pago | Pago en línea en curso, o envío por cotizar | Nada, se actualiza solo. Si tiene cotización pendiente, ve a *Envíos* |
| Esperando transferencia | El cliente debe transferir (reserva 48 h) | Cuando veas el dinero en el banco: **Confirmar pago** con la referencia y el monto exacto |
| Esperando proveedor | Pagado, con ítems bajo pedido | Llama al proveedor y marca **Sí tiene / No tiene** por ítem |
| En preparación | Pagado y listo para alistar | Empaca y registra el despacho en *Envíos* |
| Enviado | Despachado con transportadora y guía | Actualiza a *En tránsito* o *Entregado* |
| Incidencia | Monto distinto, pago tardío, reverso, pago antes de aceptar la cotización o proveedor sin stock | Resuélvelo con el cliente. Luego devuelve el pedido a preparación o cancélalo |
| Cancelado | — | Al cancelar, el stock reservado se libera |

**Pagos:** un pedido solo pasa a pagado cuando la pasarela lo confirma por webhook o consulta verificada (o cuando confirmas una transferencia). Si un pago es rechazado, el cliente puede **reintentar** o cambiar de método desde el enlace privado de su pedido, mientras siga vigente la reserva. En `/admin/payments` ves todos los intentos y los eventos recibidos de cada pasarela, incluidos los rechazados o con error.

**Enlace del cliente:** cada pedido tiene un enlace privado (`/checkout/result?order=…&t=…`) que aparece en la ficha del pedido. Ahí el cliente ve sus estados, paga, acepta la cotización y sigue el envío. También puede rastrear en `/orders/track` con número y correo.

## Envíos (sales)

`/admin/shipping` tiene dos pestañas:

- **Despachos y cotizaciones.** *Pendientes de cotización* lista los pedidos a zonas sin tarifa: entra al pedido y registra el valor en **Cotizar envío**. El cliente recibe el nuevo total en su enlace y debe aceptarlo antes de pagar. Nunca se cobra sin aceptación. *Pedidos pagados* es el tablero de despacho: estado (preparando, despachado, en tránsito, entregado, novedad en la entrega), transportadora, número de guía y observación. Despachar exige transportadora y guía.
- **Zonas y tarifas.** Ciudad → departamento → resto del país. Cada zona puede tener tarifa, envío gratis desde, tiempo estimado o requerir cotización.

## Contenido del inicio (admin)

En `/admin/home` subes las fotos del hero, de las 5 categorías, del banner y de la sección de marca, cada una con su texto alternativo. Mientras un espacio no tenga foto, el inicio muestra un panel gráfico de marca. Usa solo fotos propias o con licencia.

## Promociones (admin)

En la ficha del producto → **Promoción**: ingresa el precio promocional, que debe ser menor al actual.

- El precio actual queda como *precio anterior* y se registra la promoción. Así el descuento que ve el cliente es real.
- **Finalizar promoción** restaura el precio.

## Campañas del hero (admin)

**Campañas:** titular, subtítulo, palabras monumentales y los productos del hero y del carrusel (slug o referencia, uno por línea; el primero es el protagonista).

- Solo una campaña puede estar activa a la vez.
- Puedes programar inicio y fin.
- Usa solo productos publicados y con foto.

## Configuración y roles (admin)

**Configuración:** WhatsApp, contacto, redes, descripción de la tienda, envíos (tarifa general o cotización, horas de reserva de una cotización), instrucciones de transferencia, pasarelas de pago (cada tarjeta muestra si sus credenciales están completas y si está en pruebas o producción), vigencia de proveedor y umbral de stock bajo.

**Roles:** asigna roles a personas que ya crearon su cuenta en `/login`. Revoca el rol cuando alguien deje el equipo.

## Buenas prácticas

- No publiques productos, marcas, descuentos ni testimonios que no sean reales.
- No subas fotos ni modelos 3D sin derechos de uso.
- Ante cualquier pago dudoso, deja el pedido en *Incidencia* y anota el motivo. No lo despaches.
