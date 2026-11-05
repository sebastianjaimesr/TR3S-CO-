import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, can } from "@/lib/auth";
import { PageHeader, Flash, Table, Td, Field, Pill, Notice } from "@/features/admin/ui";
import { ProductForm } from "@/features/admin/ProductForm";
import { addSizeRun, deleteImage, deleteProduct, endPromotion, saveVariant, startPromotion } from "@/features/admin/actions/products";
import { ImageUploader, ModelUploader } from "@/features/admin/MediaUploader";
import { formatCOP } from "@/lib/format";
import { availabilityLabel } from "@/services/availability";

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const staff = await requireStaff(["inventory"]);
  const [{ data: product }, { data: brands }, { data: categories }, { data: images }, { data: variants }] = await Promise.all([
    staff.sb.from("products").select("*").eq("id", id).maybeSingle(),
    staff.sb.from("brands").select("id, name").order("name"),
    staff.sb.from("categories").select("id, name").order("position"),
    staff.sb.from("product_images").select("*").eq("product_id", id).order("position"),
    staff.sb.from("product_variants").select("*").eq("product_id", id).order("color").order("size"),
  ]);
  if (!product) notFound();
  const { data: avail } = await staff.sb.from("variant_availability").select("*").in("variant_id", (variants ?? []).map((v) => v.id));
  const av = new Map((avail ?? []).map((a) => [a.variant_id, a]));

  return (
    <>
      <PageHeader
        title={product.name}
        eyebrow={`Producto · ${product.reference}`}
        actions={<Link href={`/product/${product.slug}`} target="_blank" className="btn btn-ghost h-10 min-h-0">Ver en tienda</Link>}
      />
      <Flash sp={await searchParams} />
      {(() => {
        const missing = [
          !images?.length && "fotografías propias o autorizadas",
          !variants?.length && "variantes (talla/color)",
          !(avail ?? []).some((a) => a.status !== "sold_out") && "inventario propio o stock de proveedor confirmado",
        ].filter(Boolean);
        return missing.length ? (
          <Notice>{product.is_active ? "Publicado pero incompleto" : "Antes de publicar"}: falta {missing.join(", ")}.</Notice>
        ) : null;
      })()}
      <ProductForm product={product} brands={brands ?? []} categories={categories ?? []} />

      <section className="mt-12">
        <h2 className="mb-3 font-display text-lg font-semibold">Fotografías</h2>
        <p className="mb-4 text-xs text-smoke">Solo fotos reales propias o autorizadas por el proveedor. Recomendado: lateral, medial, frontal, trasera, superior, suela y una lifestyle; fondo blanco o gris claro uniforme, luz de estudio suave, mínimo 2000 px en el lado largo. La primera foto (vista lateral) es la portada y aparece en el inicio.</p>
        <div className="flex flex-wrap gap-3">
          {images?.map((im) => (
            <form key={im.id} action={deleteImage} className="relative h-32 w-32 border border-line bg-coal">
              <Image src={im.url} alt={im.alt} fill sizes="128px" className="object-contain p-2" />
              <input type="hidden" name="id" value={im.id} />
              <input type="hidden" name="product_id" value={id} />
              <button className="absolute right-1 top-1 bg-ink/80 px-2 text-xs" aria-label="Eliminar imagen">✕</button>
            </form>
          ))}
        </div>
        <ImageUploader productId={id} />
        <ModelUploader productId={id} current={product.model_url ?? null} />
      </section>

      <section className="mt-12">
        <h2 className="mb-3 font-display text-lg font-semibold">Variantes (talla / color)</h2>
        <Table head={["SKU", "Talla", "Color", "Precio", "Propio", "Proveedor", "Estado", ""]} empty={!variants?.length}>
          {variants?.map((v) => {
            const a = av.get(v.id);
            return (
              <tr key={v.id}>
                <Td colSpan={8} className="p-0">
                  <form action={saveVariant} className="grid grid-cols-2 items-end gap-2 p-3 md:grid-cols-[1.4fr_.6fr_1fr_1fr_.6fr_.8fr_1fr_auto]">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="product_id" value={id} />
                    <input name="sku" defaultValue={v.sku} className="field h-10 min-h-0 text-xs" aria-label="SKU" />
                    <input name="size" defaultValue={v.size} className="field h-10 min-h-0 text-xs" aria-label="Talla" />
                    <input name="color" defaultValue={v.color} className="field h-10 min-h-0 text-xs" aria-label="Color" />
                    <input name="price" defaultValue={v.price ?? ""} placeholder={formatCOP(product.price)} className="field h-10 min-h-0 text-xs" aria-label="Precio especial" />
                    <span className="text-sm">{a?.own_available ?? 0}</span>
                    <span className="text-sm">{a?.supplier_available ?? 0}</span>
                    <span className="flex items-center gap-2">
                      <Pill tone={a?.status === "available_now" ? "ok" : a?.status === "available_on_order" ? "warn" : "bad"}>{availabilityLabel[(a?.status ?? "sold_out") as "sold_out"]}</Pill>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={v.is_active} /> activa</label>
                      <input type="hidden" name="color_hex" value={v.color_hex ?? ""} />
                    </span>
                    <button className="btn btn-ghost h-10 min-h-0 px-3 text-[10px]">Guardar</button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-2 text-xs text-smoke">El stock propio se carga en Inventario; la disponibilidad del proveedor en Proveedores.</p>
        <form action={addSizeRun} className="mt-6 grid gap-3 border border-line p-4 md:grid-cols-4">
          <input type="hidden" name="product_id" value={id} />
          <p className="eyebrow md:col-span-4">Agregar curva de tallas</p>
          <Field label="Color" name="color" required placeholder="Negro/Blanco" />
          <Field label="Color HEX (opcional)" name="color_hex" placeholder="#111111" />
          <Field label="Tallas" name="sizes" required placeholder="38, 39, 40, 41, 42" />
          <button className="btn btn-ghost h-12 self-end">Crear variantes</button>
        </form>
      </section>

      {can(staff, ["admin"]) && (
        <section className="mt-12">
          <h2 className="mb-3 font-display text-lg font-semibold">Promoción real</h2>
          {product.compare_at_price ? (
            <form action={endPromotion} className="flex items-center gap-4">
              <input type="hidden" name="product_id" value={id} />
              <p className="text-sm">En promoción: {formatCOP(product.price)} (antes {formatCOP(product.compare_at_price)})</p>
              <button className="btn btn-ghost h-10 min-h-0">Finalizar promoción</button>
            </form>
          ) : (
            <form action={startPromotion} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="product_id" value={id} />
              <Field label="Nombre" name="name" placeholder="Black Friday" />
              <Field label="Precio promocional" name="promo_price" type="number" required />
              <Field label="Termina (opcional)" name="ends_at" type="date" />
              <button className="btn btn-accent h-12 self-end">Activar</button>
            </form>
          )}
        </section>
      )}

      <section className="mt-16 border-t border-line pt-6">
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={id} />
          <button className="text-sm text-crimson underline">Eliminar producto (si tiene pedidos se desactiva)</button>
        </form>
      </section>
    </>
  );
}
