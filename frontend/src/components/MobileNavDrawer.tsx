import { useEffect } from "react";
import type { Tab } from "../App";
import { CORTEX_MOBILE_DRAWER_NAV } from "../navigation";
import { NavIcon } from "./NavIcon";
import { CortexBrand } from "./brand/CortexBrand";

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
          <CortexBrand variant="appbar" />
          <button type="button" className="mobile-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <nav className="mobile-drawer-nav" aria-label="Main">
          {CORTEX_MOBILE_DRAWER_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-drawer-item ${active === item.id ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <NavIcon name={item.icon} size={22} className="mobile-drawer-item__icon" />
              <span className="mobile-drawer-item__label">{item.label}</span>
              <span className="mobile-drawer-item__chev" aria-hidden>›</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
};
