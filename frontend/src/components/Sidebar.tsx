import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { Tab } from "../tab";
import { CORTEX_MAIN_NAV } from "../navigation";
import { NavIcon } from "./NavIcon";
import { CortexBrand } from "./brand/CortexBrand";

const STORAGE_KEY = "cortex-sidebar-collapsed";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ active, onChange, mobileOpen, onClose }: Props) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    // Auto-collapse on mobile on first render
    if (typeof window !== "undefined" && window.innerWidth <= 768) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Auto-collapse when viewport shrinks to mobile
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCollapsed(true);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

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
      className={`sidebar sidebar--drawer${mobileOpen ? " sidebar--open" : ""}${collapsed ? " sidebar--collapsed" : ""}`}
      role="dialog"
      aria-modal={mobileOpen}
      aria-label="Navigation"
    >
      <div className="sidebar-logo">
        {!collapsed && <CortexBrand variant="sidebar" />}
        {onClose ? (
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft size={16} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {!collapsed && <p className="sidebar-nav-heading">Navigate</p>}
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
            title={collapsed ? item.label : undefined}
          >
            <NavIcon name={item.icon} className="sidebar-nav-icon" />
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-status">
          <span className="sidebar-status-dot" />
          {!collapsed && (
            <>
              <span className="sidebar-status-text">Cortex</span>
              <span className="sidebar-version">v1.0</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
