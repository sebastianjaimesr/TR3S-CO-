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

| Estado | Qué significa | Qué hacer |
|---|---|---|
| Pendiente de pago | Pago con Wompi en curso (reserva 60 min) | Nada; se actualiza solo |
| Esperando transferencia | El cliente debe transferir (reserva 48 h) | Al ver el dinero en el banco: **Confirmar pago** con la referencia bancaria y el monto exacto |
| Esperando proveedor | Pagado, con ítems bajo pedido | Llama al proveedor y marca **Sí tiene / No tiene** por ítem. Cuando todos están confirmados, pasa solo a *En preparación* |
| En preparación | Listo para alistar | Empaca y usa **Marcar despachado** con transportadora y guía |
| Despachado | En camino | Cuando llegue, cambia a **Entregado** |
| Incidencia | Monto distinto, pago tardío o proveedor sin stock | Resuélvelo con el cliente (cambio, espera o reembolso por Wompi o transferencia). Luego devuelve el pedido a preparación o cancélalo |
| Cancelado | — | Al cancelar, el stock reservado se libera, o se reingresa si ya se había descontado |

El cliente sigue su pedido en `/orders/track` con número y correo. El botón de WhatsApp del pedido abre un mensaje con el número del pedido.

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

**Configuración:** WhatsApp, contacto, redes, envíos, instrucciones de transferencia, métodos de pago, vigencia de proveedor y umbral de stock bajo.

**Roles:** asigna roles a personas que ya crearon su cuenta en `/login`. Revoca el rol cuando alguien deje el equipo.

## Buenas prácticas

- No publiques productos, marcas, descuentos ni testimonios que no sean reales.
- No subas fotos ni modelos 3D sin derechos de uso.
- Ante cualquier pago dudoso, deja el pedido en *Incidencia* y anota el motivo. No lo despaches.
