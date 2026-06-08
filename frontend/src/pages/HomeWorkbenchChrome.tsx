import { Plus } from "lucide-react";
import type { Tab } from "../tab";
import { HomeGlanceBar } from "../components/home/HomeGlanceBar";

interface Props {
  onOpenLibrary: () => void;
  onCommand?: () => void;
  onNavigate: (tab: Tab) => void;
}

/** Home controls for the canvas board (add widget). */
export function HomeWorkbenchChrome({ onOpenLibrary, onCommand, onNavigate }: Props) {
  return (
    <div className="home-workbench-chrome">
      <HomeGlanceBar onNavigate={onNavigate} />
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
      </div>
    </div>
  );
}
