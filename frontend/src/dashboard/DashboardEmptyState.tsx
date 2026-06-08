import { Plus } from "lucide-react";

interface Props {
  onAddWidget: () => void;
}

export function DashboardEmptyState({ onAddWidget }: Props) {
  return (
    <div className="dashboard-empty" role="status">
      <div className="dashboard-empty__card">
        <h2 className="dashboard-empty__title">Build your board</h2>
        <p className="dashboard-empty__text">
          Start with a blank canvas. Add widgets or images, configure size and text, then place them
          on your board.
        </p>
        <div className="dashboard-empty__actions">
          <button type="button" className="dashboard-empty__btn dashboard-empty__btn--primary" onClick={onAddWidget}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add widget or image
          </button>
        </div>
      </div>
    </div>
  );
}
