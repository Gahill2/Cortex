import type { Tab } from "../App";
import cortexLogo from "../assets/cortex-logo.png";

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home",     label: "Home",     icon: "⌂" },
  { id: "tasks",    label: "Tasks",    icon: "✓" },
  { id: "ai",       label: "AI",       icon: "◈" },
  { id: "memory",   label: "Memory",   icon: "◎" },
  { id: "mail",     label: "Mail",     icon: "✉" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

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

    <nav className="sidebar-nav">
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sidebar-nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className="sidebar-nav-icon">{item.icon}</span>
          <span className="sidebar-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>

    <div className="sidebar-footer">
      <div className="sidebar-status">
        <span className="sidebar-status-dot" />
        <span className="sidebar-status-text">Online</span>
      </div>
    </div>
  </aside>
);
