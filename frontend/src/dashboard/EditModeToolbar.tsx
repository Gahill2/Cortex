import { LayoutGrid, Plus, RotateCcw, Sparkles } from "lucide-react";

interface Props {
  editMode: boolean;
  onToggleEdit: () => void;
  onAddWidget: () => void;
  onResetLayout?: () => void;
  widgetCount: number;
}

export function EditModeToolbar({
  editMode,
  onToggleEdit,
  onAddWidget,
  onResetLayout,
  widgetCount,
}: Props) {
  return (
    <div className={`dashboard-edit-toolbar${editMode ? " dashboard-edit-toolbar--active" : ""}`}>
      <div className="dashboard-edit-toolbar__brand">
        <LayoutGrid size={18} strokeWidth={1.75} aria-hidden />
        <div>
          <span className="dashboard-edit-toolbar__title">Dashboard</span>
          <span className="dashboard-edit-toolbar__meta">
            {widgetCount} widget{widgetCount === 1 ? "" : "s"}
            {editMode ? " · Editing" : ""}
          </span>
        </div>
      </div>
      <div className="dashboard-edit-toolbar__actions">
        {!editMode && (
          <button type="button" className="dashboard-edit-toolbar__btn dashboard-edit-toolbar__btn--ghost" onClick={onAddWidget}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Add widget
          </button>
        )}
        {editMode && onResetLayout && (
          <button
            type="button"
            className="dashboard-edit-toolbar__btn dashboard-edit-toolbar__btn--ghost"
            onClick={onResetLayout}
            title="Restore starter layout"
          >
            <RotateCcw size={16} strokeWidth={2} aria-hidden />
            Reset
          </button>
        )}
        <button
          type="button"
          className={`dashboard-edit-toolbar__btn dashboard-edit-toolbar__btn--primary${editMode ? " is-done" : ""}`}
          onClick={onToggleEdit}
        >
          <Sparkles size={16} strokeWidth={2} aria-hidden />
          {editMode ? "Done" : "Customize"}
        </button>
      </div>
    </div>
  );
}
