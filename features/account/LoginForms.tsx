"use client";
import { useActionState, useState } from "react";
import { signIn, signUp } from "@/features/account/auth-actions";

export function LoginForms({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState(signIn, {});
  const [upState, upAction, upPending] = useActionState(signUp, {});
  const state = mode === "in" ? inState : upState;
  return (
    <div className="mt-8">
      <div role="tablist" className="mb-6 grid grid-cols-2 border border-line">
        <button role="tab" type="button" aria-selected={mode === "in"} onClick={() => setMode("in")} className={`h-11 text-sm ${mode === "in" ? "bg-paper text-ink" : ""}`}>Ingresar</button>
        <button role="tab" type="button" aria-selected={mode === "up"} onClick={() => setMode("up")} className={`h-11 text-sm ${mode === "up" ? "bg-paper text-ink" : ""}`}>Crear cuenta</button>
      </div>
      <form action={mode === "in" ? inAction : upAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="field-label">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required className="field" />
        </div>
        {state?.error && <p role="alert" className="text-sm text-crimson">{state.error}</p>}
        {state?.info && <p role="status" className="text-sm text-emerald-400">{state.info}</p>}
        <button type="submit" disabled={inPending || upPending} className="btn btn-primary w-full">{mode === "in" ? "Ingresar" : "Crear cuenta"}</button>
      </form>
    </div>
  );
}
