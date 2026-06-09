import { LayoutGrid, Plus } from "lucide-react";

interface Props {
  onAddWidget: () => void;
  onUseStarter?: () => void;
}

export function DashboardEmptyState({ onAddWidget, onUseStarter }: Props) {
  return (
    <div className="dashboard-empty" role="status">
      <div className="dashboard-empty__card">
        <h2 className="dashboard-empty__title">Build your board</h2>
        <p className="dashboard-empty__text">
          Start from a curated layout — today, tasks, calendar, mail, and more — or begin with a
          blank canvas and place widgets yourself.
        </p>
        <div className="dashboard-empty__actions">
          {onUseStarter && (
            <button
              type="button"
              className="dashboard-empty__btn dashboard-empty__btn--primary"
              onClick={onUseStarter}
            >
              <LayoutGrid size={18} strokeWidth={2} aria-hidden />
              Use starter layout
            </button>
          )}
          <button
            type="button"
            className={`dashboard-empty__btn${onUseStarter ? "" : " dashboard-empty__btn--primary"}`}
            onClick={onAddWidget}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add widget or image
          </button>
        </div>
      </div>
    </div>
  );
}
