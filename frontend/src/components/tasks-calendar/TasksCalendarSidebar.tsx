import {
  CheckSquare,
  Home,
  Mail,
  Music,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Tab } from "../../tab";

type RailItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  tab: Tab;
};

const RAIL_NAV: RailItem[] = [
  { id: "home", label: "Dashboard", icon: Home, tab: "home" },
  { id: "tasks-calendar", label: "Tasks & Calendar", icon: CheckSquare, tab: "tasks" },
  { id: "mail", label: "Email", icon: Mail, tab: "mail" },
  { id: "spotify", label: "Music", icon: Music, tab: "spotify" },
  { id: "settings", label: "Settings", icon: Settings, tab: "settings" },
];

interface Props {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
}

/** In-page rail — lucide only (no CortexBrand/NavIcon) to avoid lazy ↔ main chunk cycle. */
export function TasksCalendarSidebar({ activeTab, onNavigate }: Props) {
  const onPlanner = activeTab === "tasks";

  return (
    <aside className="tcc-rail" aria-label="Cortex navigation">
      <div className="tcc-rail-brand">
        <span className="tcc-rail-wordmark">Cortex</span>
      </div>
      <nav className="tcc-rail-nav">
        {RAIL_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.id === "tasks-calendar" ? onPlanner : activeTab === item.tab;
          return (
            <button
              key={item.id}
              type="button"
              className={`tcc-rail-item${active ? " tcc-rail-item--active" : ""}`}
              onClick={() => onNavigate(item.tab)}
            >
              <Icon size={20} strokeWidth={1.75} className="tcc-rail-icon" aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <p className="tcc-rail-foot">Command center</p>
    </aside>
  );
}
