import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "../../stores/toastStore";
export const ToastViewport = () => {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);
    return (_jsx("div", { className: "toast-viewport", "aria-live": "polite", "aria-relevant": "additions", children: _jsx(AnimatePresence, { initial: false, children: toasts.map((toast) => (_jsxs(motion.div, { className: `toast-card toast-tone-${toast.tone ?? "neutral"}`, initial: { opacity: 0, x: 48, scale: 0.96 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: 48, scale: 0.96 }, transition: { type: "spring", stiffness: 420, damping: 32 }, children: [_jsxs("div", { className: "toast-inner", children: [_jsxs("div", { className: "toast-copy", children: [_jsx("p", { className: "toast-title", children: toast.title }), toast.message ? _jsx("p", { className: "toast-message", children: toast.message }) : null] }), _jsx("button", { type: "button", className: "toast-dismiss", onClick: () => dismiss(toast.id), "aria-label": "Dismiss notification", children: "\u00D7" })] }), _jsx(motion.div, { className: "toast-progress", initial: { scaleX: 1 }, animate: { scaleX: 0 }, transition: { duration: 4, ease: "linear" }, style: { transformOrigin: "left" } })] }, toast.id))) }) }));
};
