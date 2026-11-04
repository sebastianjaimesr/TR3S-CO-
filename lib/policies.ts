/**
 * Policy drafts. BORRADORES: deben ser revisados por un abogado antes de
 * publicar en producción (Ley 1480 de 2011, Ley 1581 de 2012, Decreto 1074 de 2015).
 */
export const policies: Record<string, { title: string; sections: { h: string; p: string[] }[] }> = {
  envios: {
    title: "Política de envíos",
    sections: [
      { h: "Cobertura", p: ["Enviamos a todo el territorio colombiano mediante transportadoras aliadas. Bucaramanga y su área metropolitana tienen tiempos de entrega más cortos."] },
      { h: "Costo", p: ["El costo del envío se muestra en el carrito y en el checkout antes de pagar. Puede existir envío gratis desde un monto mínimo publicado en la tienda."] },
      { h: "Tiempos", p: ["Productos disponibles en inventario propio: despacho en 24 a 48 horas hábiles tras la confirmación del pago.", "Productos bajo pedido: primero confirmamos la disponibilidad con el proveedor; el plazo estimado se informa en el producto y en tu pedido. Si el proveedor no confirma, te contactamos y te reembolsamos el 100%."] },
      { h: "Seguimiento", p: ["Al despachar registramos la transportadora y el número de guía, visibles en “Rastrear pedido”."] },
    ],
  },
  "cambios-y-devoluciones": {
    title: "Cambios y devoluciones",
    sections: [
      { h: "Cambios de talla", p: ["Puedes solicitar cambio de talla dentro de los 5 días hábiles siguientes a la entrega, con el producto sin uso, con etiquetas y en su caja original. El cambio está sujeto a disponibilidad."] },
      { h: "Derecho de retracto", p: ["En compras a distancia puedes ejercer el derecho de retracto dentro de los 5 días hábiles siguientes a la entrega (art. 47, Ley 1480 de 2011). El producto debe devolverse en las mismas condiciones en que lo recibiste. Los costos de transporte de la devolución corren por cuenta del consumidor."] },
      { h: "Reembolsos", p: ["Los reembolsos se realizan por el mismo medio de pago dentro de los 30 días calendario siguientes a la aceptación del retracto o de la devolución."] },
    ],
  },
  garantias: {
    title: "Garantías",
    sections: [
      { h: "Garantía legal", p: ["Todos los productos cuentan con la garantía legal por defectos de fabricación. La gestionamos ante la marca o el proveedor correspondiente."] },
      { h: "Exclusiones", p: ["No cubre desgaste normal por uso, uso inadecuado, accidentes ni modificaciones al producto."] },
      { h: "Cómo solicitarla", p: ["Escríbenos con tu número de pedido, fotos del defecto y una descripción. Te responderemos con los pasos a seguir."] },
    ],
  },
  privacidad: {
    title: "Privacidad y tratamiento de datos personales",
    sections: [
      { h: "Responsable", p: ["TR3S & CO., Bucaramanga, Santander, Colombia. Los datos de contacto del responsable se publican en la página de contacto."] },
      { h: "Datos que recolectamos", p: ["Nombre, correo, teléfono, dirección de envío e historial de pedidos. No almacenamos datos de tarjetas: los pagos los procesa Wompi."] },
      { h: "Finalidades", p: ["Procesar y entregar pedidos, atender solicitudes, cumplir obligaciones legales y, solo con tu autorización, enviar comunicaciones comerciales."] },
      { h: "Analítica", p: ["Usamos Google Analytics y Meta Pixel únicamente si los aceptas en el aviso de cookies."] },
      { h: "Tus derechos", p: ["Conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización (Ley 1581 de 2012). Escríbenos por los canales de contacto."] },
    ],
  },
  terminos: {
    title: "Términos y condiciones",
    sections: [
      { h: "Quiénes somos", p: ["TR3S & CO. es una tienda multimarca independiente. No fabricamos los productos ni somos distribuidores oficiales de las marcas, salvo indicación expresa."] },
      { h: "Precios y disponibilidad", p: ["Los precios están en pesos colombianos. La disponibilidad se valida al crear el pedido; si una talla se agota durante la compra, el sistema no permite completarla.", "Los productos marcados como DEMO son ilustrativos y no están a la venta."] },
      { h: "Pedidos", p: ["Un pedido con pago por transferencia se reserva por 48 horas. Un pedido con Wompi se reserva por 60 minutos mientras se completa el pago."] },
      { h: "Ley aplicable", p: ["Estos términos se rigen por la ley colombiana."] },
    ],
  },
};
