"use client";
import { create } from "zustand";

export type ToastTone = "default" | "success" | "error";
export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { tone: "default", ...t, id }] }));
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative helper for event handlers. */
export const toast = (title: string, opts: { description?: string; tone?: ToastTone } = {}) => useToasts.getState().push({ title, ...opts });
