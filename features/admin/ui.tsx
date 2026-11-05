import Link from "next/link";
import { cn } from "@/lib/format";

export function PageHeader({ title, eyebrow, actions }: { title: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="border border-line bg-coal p-5">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-semibold", tone === "warn" && "text-amber-300", tone === "bad" && "text-crimson")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-smoke">{hint}</p>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-coal text-[11px] uppercase tracking-[0.12em] text-smoke">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-sm text-smoke">Sin registros todavía.</p>}
    </div>
  );
}

export function Td({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-top", className)}>{children}</td>;
}

export function Field({ label, name, defaultValue, type = "text", required, placeholder, hint, step, min, className }: {
  label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; placeholder?: string; hint?: string; step?: string; min?: number; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">{label}{required && " *"}</label>
      <input id={name} name={name} type={type} defaultValue={defaultValue ?? undefined} required={required} placeholder={placeholder} step={step} min={min} className="field" />
      {hint && <p className="mt-1 text-xs text-smoke">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, defaultValue, rows = 4, className }: { label: string; name: string; defaultValue?: string | null; rows?: number; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">{label}</label>
      <textarea id={name} name={name} rows={rows} defaultValue={defaultValue ?? undefined} className="field" />
    </div>
  );
}

export function Select({ label, name, options, defaultValue, className }: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string | null; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? undefined} className="field">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[#d50025]" />
      {label}
    </label>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("mb-6 border p-4 text-sm", kind === "error" ? "border-crimson/60 bg-wine/10 text-crimson" : kind === "ok" ? "border-emerald-500/40 text-emerald-300" : "border-line text-bone/80")}>
      {children}
    </p>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "muted" }) {
  return (
    <span className={cn("inline-block border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
      tone === "ok" && "border-emerald-500/40 text-emerald-300",
      tone === "warn" && "border-amber-300/40 text-amber-300",
      tone === "bad" && "border-crimson/60 text-crimson",
      (!tone || tone === "muted") && "border-line text-smoke")}>{children}</span>
  );
}

export function LinkButton({ href, children, kind = "ghost" }: { href: string; children: React.ReactNode; kind?: "ghost" | "primary" }) {
  return <Link href={href} className={cn("btn h-10 min-h-0", kind === "primary" ? "btn-primary" : "btn-ghost")}>{children}</Link>;
}

/** Reads ?ok= / ?error= flash messages set by server actions via redirect. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <>
      {ok && <Notice kind="ok">{ok}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
    </>
  );
}
