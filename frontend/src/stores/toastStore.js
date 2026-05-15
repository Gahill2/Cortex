import { create } from "zustand";
const DEFAULT_MS = 4200;
export const useToastStore = create((set) => ({
    toasts: [],
    push: (toast) => {
        const id = toast.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const dismissMs = toast.dismissMs ?? DEFAULT_MS;
        set((s) => ({
            toasts: [...s.toasts, { id, title: toast.title, message: toast.message, tone: toast.tone ?? "neutral" }]
        }));
        window.setTimeout(() => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, dismissMs);
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));
