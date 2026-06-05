import { useState, useRef, useCallback } from "react";

interface ConfirmButtonProps {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  tone?: "danger" | "neutral";
}

export function ConfirmButton({
  children,
  confirmLabel = "Confirm?",
  onConfirm,
  className = "",
  disabled = false,
  tone = "neutral",
}: ConfirmButtonProps) {
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPending(false);
  }, []);

  const handleClick = () => {
    if (disabled) return;
    if (!pending) {
      setPending(true);
      timeoutRef.current = setTimeout(() => {
        setPending(false);
      }, 3000);
      return;
    }
    clear();
    onConfirm();
  };

  const toneClass = tone === "danger" ? "btn-danger" : "btn-ghost";

  return (
    <button
      type="button"
      className={`${toneClass} ${pending ? "confirm-pending" : ""} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-live="polite"
    >
      {pending ? confirmLabel : children}
    </button>
  );
}
