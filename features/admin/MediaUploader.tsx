"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PRODUCT_VIEWS } from "@/lib/product-views";
import { registerImages, registerModel } from "@/features/admin/actions/products";
import { registerHomeMedia } from "@/features/admin/actions/commerce";

const MAX_BYTES = 5 * 1024 * 1024; // bucket limit
const MAX_SIDE = 2800;

/** Downscale only when needed (over the bucket limit or larger than MAX_SIDE). Keeps full quality otherwise. */
export async function prepare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const longest = Math.max(bmp.width, bmp.height);
  if (file.size <= MAX_BYTES && longest <= MAX_SIDE) return file;
  const scale = Math.min(1, MAX_SIDE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.92, 0.86, 0.8]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error(`${file.name} sigue pesando más de 5 MB después de optimizarla.`);
}

interface Pending {
  file: File;
  view: string;
  note: string;
  preview: string;
  width?: number;
}

export function ImageUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (list: FileList | null) => {
    if (!list) return;
    const next: Pending[] = [];
    for (const [i, f] of [...list].entries()) {
      if (!f.type.startsWith("image/")) continue;
      const bmp = await createImageBitmap(f).catch(() => null);
      next.push({ file: f, view: PRODUCT_VIEWS[Math.min(i + items.length, PRODUCT_VIEWS.length - 1)].id, note: "", preview: URL.createObjectURL(f), width: bmp ? Math.max(bmp.width, bmp.height) : undefined });
    }
    setItems((s) => [...s, ...next].slice(0, 12));
  };

  const upload = async () => {
    const sb = supabaseBrowser();
    if (!sb || !items.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const done: { path: string; view: string; note: string }[] = [];
      for (const it of items) {
        const blob = await prepare(it.file);
        const ext = blob.type === "image/webp" ? "webp" : (it.file.type.split("/")[1] ?? "jpg");
        const path = `${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("products").upload(path, blob, { contentType: blob.type || it.file.type, upsert: false, cacheControl: "31536000" });
        if (error) throw new Error(`${it.file.name}: ${error.message}`);
        done.push({ path, view: it.view, note: it.note });
      }
      const res = await registerImages({ productId, items: done });
      if (!res.ok) throw new Error(res.error);
      items.forEach((i) => URL.revokeObjectURL(i.preview));
      setItems([]);
      setMsg({ ok: true, text: `${res.count} foto(s) publicadas.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo subir." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border border-line p-4">
      <label className="field-label" htmlFor="photos">Agregar fotos (puedes seleccionar varias)</label>
      <input id="photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => pick(e.target.files)} className="text-sm" />
      {items.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={it.preview} className="flex gap-3 border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.preview} alt="" className="h-20 w-20 shrink-0 bg-studio object-contain" />
              <div className="min-w-0 flex-1 space-y-2">
                <select value={it.view} onChange={(e) => setItems((s) => s.map((x, j) => (j === i ? { ...x, view: e.target.value } : x)))} className="field min-h-0 py-1.5 text-sm" aria-label="Vista">
                  {PRODUCT_VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                <input value={it.note} onChange={(e) => setItems((s) => s.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder="Color (opcional)" className="field min-h-0 py-1.5 text-sm" maxLength={80} />
                <p className={`text-[11px] ${it.width && it.width < 1600 ? "text-crimson" : "text-smoke"}`}>
                  {it.width ? `${it.width}px` : ""} {it.width && it.width < 1600 ? "· baja resolución, se verá menos nítida" : ""}
                </p>
              </div>
              <button type="button" onClick={() => setItems((s) => s.filter((_, j) => j !== i))} className="self-start px-2 text-smoke hover:text-paper" aria-label="Quitar">×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={upload} disabled={busy || !items.length} className="btn btn-primary h-11 min-h-0">{busy ? "Subiendo…" : `Subir ${items.length || ""} foto(s)`}</button>
        {msg && <p role="status" className={msg.ok ? "text-sm text-bone" : "text-sm text-crimson"}>{msg.text}</p>}
      </div>
    </div>
  );
}

export function ModelUploader({ productId, current }: { productId: string; current: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (file: File | undefined) => {
    const sb = supabaseBrowser();
    if (!sb || !file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) return setMsg({ ok: false, text: "Solo archivos .glb" });
    if (file.size > 15 * 1024 * 1024) return setMsg({ ok: false, text: "El modelo supera 15 MB: optimízalo (ver docs/04-REDISENO-3D.md)." });
    setBusy(true);
    setMsg(null);
    const path = `${productId}/${crypto.randomUUID()}.glb`;
    const { error } = await sb.storage.from("models").upload(path, file, { contentType: "model/gltf-binary", upsert: false, cacheControl: "31536000" });
    const res = error ? { ok: false, error: error.message } : await registerModel({ productId, path });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Modelo 3D publicado. El visor 360° ya está activo." } : { ok: false, text: res.error ?? "No se pudo subir." });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mt-4 border border-line p-4">
      <p className="field-label">Modelo 3D autorizado (.glb, máx. 15 MB)</p>
      <p className="mb-3 text-xs text-smoke">Solo el modelo oficial de ESTA referencia (del fabricante o proveedor, con permiso de uso). Sin modelo, la tienda muestra fotos: nunca un 3D genérico.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".glb,model/gltf-binary" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} className="text-sm" />
        {current && (
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); const r = await registerModel({ productId, path: null }); setBusy(false); if (r.ok) router.refresh(); }} className="btn btn-ghost h-10 min-h-0">
            Quitar modelo
          </button>
        )}
      </div>
      {current && <p className="mt-2 truncate text-xs text-smoke">Actual: {current}</p>}
      {msg && <p role="status" className={msg.ok ? "mt-2 text-sm text-bone" : "mt-2 text-sm text-crimson"}>{msg.text}</p>}
    </div>
  );
}

/** True when the image's border is transparent (a cut-out product photo). */
async function hasTransparentEdges(file: File): Promise<boolean> {
  if (!/png|webp|avif/.test(file.type)) return false;
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let clear = 0;
  let total = 0;
  for (let i = 0; i < 64; i++) {
    for (const [x, y] of [[i, 0], [i, 63], [0, i], [63, i]]) {
      total++;
      if (d[(y * 64 + x) * 4 + 3] < 16) clear++;
    }
  }
  return clear / total > 0.9;
}

/** Crops the transparent margins of a cut-out so the sole sits exactly on the pedestal. */
async function trimTransparent(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === c.width - 1 && y1 === c.height - 1)) return file;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(c, x0, y0, w, h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/webp", 0.95));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" }) : file;
}

/**
 * One home image slot: direct browser upload to the `campaigns` bucket, then
 * the server records it. Hero stage slots expect cut-out photos (no background).
 */
export function HomeMediaUploader({ slot, alt, hasImage, stage }: { slot: string; alt: string; hasImage: boolean; stage: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState<{ width: number; transparent: boolean } | null>(null);
  const [text, setText] = useState(alt);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (f: File | undefined) => {
    if (preview) URL.revokeObjectURL(preview);
    setMsg(null);
    if (!f || !f.type.startsWith("image/")) return setFile(null);
    const bmp = await createImageBitmap(f).catch(() => null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setInfo({ width: bmp ? Math.max(bmp.width, bmp.height) : 0, transparent: await hasTransparentEdges(f).catch(() => false) });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let path: string | null = null;
      if (file) {
        const sb = supabaseBrowser();
        if (!sb) throw new Error("Supabase no está configurado.");
        const source = stage && info?.transparent ? await trimTransparent(file) : file;
        const blob = await prepare(source);
        const ext = blob.type === "image/webp" ? "webp" : (source.type.split("/")[1] ?? "jpg");
        path = `home/${slot}-${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("campaigns").upload(path, blob, { contentType: blob.type || source.type, upsert: false, cacheControl: "31536000" });
        if (error) throw new Error(error.message);
      }
      const res = await registerHomeMedia({ slot, path, alt: text });
      if (!res.ok) throw new Error(res.error);
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
      setInfo(null);
      setMsg({ ok: true, text: "Publicado en el inicio." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo publicar." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div>
        <label className="field-label" htmlFor={`img-${slot}`}>{stage ? "Foto recortada (PNG o WEBP sin fondo)" : "Imagen (JPG, PNG, WEBP, AVIF)"}</label>
        <input id={`img-${slot}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" />
      </div>
      {preview && info && (
        <div className="flex items-center gap-3 border border-line p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-16 w-16 shrink-0 bg-graphite object-contain" />
          <div className="text-[11px] leading-relaxed">
            <p className={info.width < 1600 ? "text-crimson" : "text-smoke"}>{info.width}px{info.width < 1600 ? " · baja resolución, se verá menos nítida" : ""}</p>
            {stage && (
              <p className={info.transparent ? "text-smoke" : "text-crimson"}>
                {info.transparent ? "Sin fondo: lista para el escenario (los márgenes vacíos se recortan solos)." : "Tiene fondo: en el escenario se verá como un recuadro. Recórtala (por ejemplo con Photoroom o remove.bg) y súbela en PNG o WEBP."}
              </p>
            )}
          </div>
        </div>
      )}
      <div>
        <label className="field-label" htmlFor={`alt-${slot}`}>{stage ? "Nombre del modelo (se muestra al pasar el cursor)" : "Descripción de la imagen"}</label>
        <input id={`alt-${slot}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={160} className="field" placeholder={stage ? "Ej.: Nike Air Max 97 Triple Black" : "Ej.: Tenis blancos sobre fondo negro"} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || (!file && !hasImage)} className="btn btn-primary h-10 min-h-0">{busy ? "Publicando…" : "Publicar"}</button>
        {msg && <p role="status" className={msg.ok ? "text-sm text-bone" : "text-sm text-crimson"}>{msg.text}</p>}
      </div>
    </div>
  );
}
