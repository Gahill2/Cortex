import { useEffect } from "react";
import type { Tab } from "../App";
import { CORTEX_MAIN_NAV } from "../navigation";
import { NavIcon } from "./NavIcon";
import { CortexBrand } from "./brand/CortexBrand";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ active, onChange, mobileOpen, onClose }: Props) => {
  useEffect(() => {
    if (!mobileOpen || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  return (
    <aside
      className={`sidebar sidebar--drawer ${mobileOpen ? "sidebar--open" : ""}`}
      role="dialog"
      aria-modal={mobileOpen}
      aria-label="Navigation"
    >
      <div className="sidebar-logo">
        <CortexBrand variant="sidebar" />
        {onClose && (
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        <p className="sidebar-nav-heading">Navigate</p>
        {CORTEX_MAIN_NAV.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-item sidebar-nav-item--animated ${active === item.id ? "active" : ""}`}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => {
              onChange(item.id);
              onClose?.();
            }}
            data-badge=""
          >
            <NavIcon name={item.icon} className="sidebar-nav-icon" />
            <span className="sidebar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-status">
          <span className="sidebar-status-dot" />
          <span className="sidebar-status-text">Cortex</span>
          <span className="sidebar-version">v1.0</span>
        </div>
      </div>
    </aside>
  );
};
