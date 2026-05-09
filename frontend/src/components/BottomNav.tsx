import type { Tab } from "../App";

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "ai", label: "AI", icon: "◈" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export const BottomNav = ({ active, onChange }: Props) => (
  <nav className="bottom-nav" aria-label="Main navigation">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        className={`bottom-nav-item ${active === tab.id ? "active" : ""}`}
        onClick={() => onChange(tab.id)}
        aria-current={active === tab.id ? "page" : undefined}
      >
        <span className="bottom-nav-icon">{tab.icon}</span>
        <span className="bottom-nav-label">{tab.label}</span>
      </button>
    ))}
  </nav>
);
