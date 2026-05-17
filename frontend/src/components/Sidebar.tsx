import type { Tab } from "../App";
import { CORTEX_MAIN_NAV } from "../navigation";
import cortexLogo from "../assets/cortex-logo.png";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ active, onChange, mobileOpen, onClose }: Props) => (
  <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
    <div className="sidebar-logo">
      <img src={cortexLogo} alt="Cortex" className="cortex-logo-img sidebar-logo-img" />
      {onClose && (
        <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          ×
        </button>
      )}
    </div>

    <nav className="sidebar-nav" aria-label="Primary">
      <p className="sidebar-nav-heading">Navigate</p>
      {CORTEX_MAIN_NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sidebar-nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
          data-badge=""
        >
          <span className="sidebar-nav-icon">{item.emoji}</span>
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
