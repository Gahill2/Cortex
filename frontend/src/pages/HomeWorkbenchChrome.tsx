import { LayoutGrid, Plus, SlidersHorizontal } from "lucide-react";
import { useDashboardLayoutStore } from "../productivity-dashboard/state/dashboardLayoutStore";

interface Props {
  onOpenLibrary: () => void;
  onCommand?: () => void;
}

/** Home controls for the canvas board (add widget, customize). */
export function HomeWorkbenchChrome({ onOpenLibrary, onCommand }: Props) {
  const editMode = useDashboardLayoutStore((s) => s.editMode);
  const setEditMode = useDashboardLayoutStore((s) => s.setEditMode);

  return (
    <div className="home-workbench-chrome">
      <div className="home-workbench-chrome__actions">
        <button
          type="button"
          className="home-workbench-chrome__btn home-workbench-chrome__btn--ghost"
          onClick={onCommand}
          aria-label="Command palette"
        >
          <span className="home-workbench-chrome__kbd">⌘K</span>
        </button>
        <button type="button" className="home-workbench-chrome__btn" onClick={onOpenLibrary}>
          <Plus size={17} />
          Add widget
        </button>
        <button
          type="button"
          className={`home-workbench-chrome__btn${editMode ? " home-workbench-chrome__btn--active" : ""}`}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? <LayoutGrid size={17} /> : <SlidersHorizontal size={17} />}
          {editMode ? "Done" : "Customize"}
        </button>
      </div>
    </div>
  );
}
