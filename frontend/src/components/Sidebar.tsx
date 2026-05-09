import type { Tab } from "../App";

const NAV: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home",     label: "Home",     icon: "⌂" },
  { id: "tasks",    label: "Tasks",    icon: "✓" },
  { id: "ai",       label: "AI",       icon: "◈" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

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

    <nav className="sidebar-nav">
      {NAV.map((item) => (
        <button
          key={item.id}
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
