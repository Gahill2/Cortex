export type ToastTone = "neutral" | "success" | "error";
export type ShellToast = {
    id: string;
    title: string;
    message?: string;
    tone?: ToastTone;
};
type ToastState = {
    toasts: ShellToast[];
    push: (toast: Omit<ShellToast, "id"> & {
        id?: string;
        dismissMs?: number;
    }) => void;
    dismiss: (id: string) => void;
};
export declare const useToastStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ToastState>>;
export {};
