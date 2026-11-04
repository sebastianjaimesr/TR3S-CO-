import { Field, Select, TextArea, Check } from "@/features/admin/ui";
import { saveProduct } from "@/features/admin/actions/products";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ProductForm({ product, brands, categories }: { product?: any; brands: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  return (
    <form action={saveProduct} className="grid gap-4 md:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="Nombre" name="name" defaultValue={product?.name} required />
      <Field label="Referencia (modelo)" name="reference" defaultValue={product?.reference} required />
      <Select label="Marca" name="brand_id" defaultValue={product?.brand_id} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
      <Select label="Categoría" name="category_id" defaultValue={product?.category_id} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      <Select label="Género" name="gender" defaultValue={product?.gender ?? "unisex"} options={[{ value: "men", label: "Hombre" }, { value: "women", label: "Mujer" }, { value: "unisex", label: "Unisex" }]} />
      <Field label="Tipo de calzado" name="shoe_type" defaultValue={product?.shoe_type ?? "sneaker"} hint="sneaker, running, training, formal, boot, sandal, platform…" />
      <Field label="Precio (COP)" name="price" type="number" min={1} defaultValue={product?.price} required />
      <Field label="Precio anterior (solo si hay descuento real)" name="compare_at_price" type="number" defaultValue={product?.compare_at_price} />
      <Field label="Slug (URL)" name="slug" defaultValue={product?.slug} hint="Se genera automáticamente si lo dejas vacío." />
      <Field label="Orden en destacados" name="featured_rank" type="number" defaultValue={product?.featured_rank} hint="Menor número = aparece primero." />
      <TextArea label="Descripción" name="description" defaultValue={product?.description} className="md:col-span-2" />
      <TextArea label="Materiales" name="materials" defaultValue={product?.materials} rows={2} className="md:col-span-2" />
      <Field label="Modelo 3D autorizado (URL .glb)" name="model_url" defaultValue={product?.model_url} hint="Solo un modelo de ESTA referencia, con licencia. Súbelo al bucket 'models'." className="md:col-span-2" />
      <div className="flex flex-wrap gap-6 md:col-span-2">
        <Check label="Publicado" name="is_active" defaultChecked={product?.is_active ?? false} />
        <Check label="Marcar como NEW" name="is_new" defaultChecked={product?.is_new} />
        <Check label="Producto DEMO (no se vende)" name="is_demo" defaultChecked={product?.is_demo} />
      </div>
      <button className="btn btn-primary md:col-span-2 md:w-fit">Guardar producto</button>
    </form>
  );
}
