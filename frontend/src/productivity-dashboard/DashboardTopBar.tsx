import { LayoutGrid, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { DashboardViewMode, HomeLayoutMode } from "./types";
import { formatLongDate } from "./utils/dateUtils";

interface Props {
  greeting: string;
  homeLayout: HomeLayoutMode;
  onHomeLayoutChange: (layout: HomeLayoutMode) => void;
  view: DashboardViewMode;
  editMode: boolean;
  onViewChange: (v: DashboardViewMode) => void;
  onOpenLibrary: () => void;
  onToggleEdit: () => void;
  onCommand?: () => void;
}

const HOME_LAYOUTS: { id: HomeLayoutMode; label: string }[] = [
  { id: "widgets", label: "Widgets" },
  { id: "board", label: "Board" },
];

const VIEWS: { id: DashboardViewMode; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "goals", label: "Goals" },
  { id: "habits", label: "Habits" },
];

export function DashboardTopBar({
  greeting,
  homeLayout,
  onHomeLayoutChange,
  view,
  editMode,
  onViewChange,
  onOpenLibrary,
  onToggleEdit,
  onCommand,
}: Props) {
  const widgetsMode = homeLayout === "widgets";

  return (
    <header className={`pd-topbar${editMode ? " pd-topbar--edit" : ""}`}>
      <div className="pd-topbar__lead">
        <h1 className="pd-topbar__greeting">{greeting}</h1>
        <p className="pd-topbar__date">{formatLongDate()}</p>
      </div>
      <nav className="pd-topbar__views" aria-label="Home layout and sections">
        {HOME_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={homeLayout === l.id ? "is-active" : ""}
            onClick={() => onHomeLayoutChange(l.id)}
          >
            {l.label}
          </button>
        ))}
        <span className="pd-topbar__views-divider" aria-hidden />
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={view === v.id ? "is-active" : ""}
            onClick={() => onViewChange(v.id)}
            disabled={v.id === "habits"}
            title={v.id === "habits" ? "Coming soon" : v.id !== "dashboard" ? "Open full page" : undefined}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="pd-topbar__actions">
        <button type="button" className="pd-topbar__btn pd-topbar__btn--ghost" onClick={onCommand} aria-label="Search">
          <Search size={18} />
          <span className="pd-topbar__kbd">⌘K</span>
        </button>
        {widgetsMode ? (
          <>
            <button type="button" className="pd-topbar__btn" onClick={onOpenLibrary}>
              <Plus size={18} />
              Add widget
            </button>
            <button
              type="button"
              className={`pd-topbar__btn${editMode ? " pd-topbar__btn--active" : ""}`}
              onClick={onToggleEdit}
            >
              {editMode ? <LayoutGrid size={18} /> : <SlidersHorizontal size={18} />}
              {editMode ? "Done" : "Customize"}
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
