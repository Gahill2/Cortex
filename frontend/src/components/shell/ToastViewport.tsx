import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "../../stores/toastStore";

export const ToastViewport = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast-card toast-tone-${toast.tone ?? "neutral"}`}
            initial={{ opacity: 0, x: 48, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="toast-inner">
              <div className="toast-copy">
                <p className="toast-title">{toast.title}</p>
                {toast.message ? <p className="toast-message">{toast.message}</p> : null}
              </div>
              <button type="button" className="toast-dismiss" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
                ×
              </button>
            </div>
            <motion.div
              className="toast-progress"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 4, ease: "linear" }}
              style={{ transformOrigin: "left" }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
