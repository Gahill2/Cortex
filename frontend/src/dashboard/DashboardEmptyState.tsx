import { LayoutGrid, Plus } from "lucide-react";

interface Props {
  onCustomize: () => void;
  onAddWidget: () => void;
}

export function DashboardEmptyState({ onCustomize, onAddWidget }: Props) {
  return (
    <div className="dashboard-empty" role="status">
      <div className="dashboard-empty__card">
        <LayoutGrid size={40} strokeWidth={1.25} className="dashboard-empty__icon" aria-hidden />
        <h2 className="dashboard-empty__title">Your personal dashboard</h2>
        <p className="dashboard-empty__text">
          Add widgets, drag them anywhere, and resize like an iOS home screen — powered by your
          infinite canvas.
        </p>
        <div className="dashboard-empty__actions">
          <button type="button" className="dashboard-empty__btn dashboard-empty__btn--primary" onClick={onAddWidget}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            Browse widgets
          </button>
          <button type="button" className="dashboard-empty__btn" onClick={onCustomize}>
            Customize layout
          </button>
        </div>
      </div>
    </div>
  );
}
