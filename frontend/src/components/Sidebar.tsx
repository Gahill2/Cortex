import type { Tab } from "../App";
import { CORTEX_MAIN_NAV } from "../navigation";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export const Sidebar = ({ active, onChange }: Props) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="sidebar-logo-mark">C</div>
      <span className="sidebar-logo-text">Cortex</span>
    </div>

    <nav className="sidebar-nav" aria-label="Primary">
      <p className="sidebar-nav-heading">Navigate</p>
      {CORTEX_MAIN_NAV.map((item) => (
        <button
          key={item.id}
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
