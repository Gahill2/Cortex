import { useEffect } from "react";
import type { Tab } from "../App";
import { CORTEX_MAIN_NAV } from "../navigation";

interface Props {
  open: boolean;
  onClose: () => void;
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export const MobileNavDrawer = ({ open, onClose, active, onSelect }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="mobile-drawer-root" role="presentation">
      <button
        type="button"
        className="mobile-drawer-backdrop"
        onClick={onClose}
        aria-label="Close menu"
      />
      <aside
        className="mobile-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-brand">Cortex</span>
          <button type="button" className="mobile-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <nav className="mobile-drawer-nav" aria-label="Main">
          {CORTEX_MAIN_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-drawer-item ${active === item.id ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="mobile-drawer-item__emoji" aria-hidden>{item.emoji}</span>
              <span className="mobile-drawer-item__label">{item.label}</span>
              <span className="mobile-drawer-item__chev" aria-hidden>›</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
};
