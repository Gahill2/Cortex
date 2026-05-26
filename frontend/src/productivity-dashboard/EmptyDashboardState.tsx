import { LayoutGrid, Plus } from "lucide-react";

interface Props {
  onAddWidgets?: () => void;
}

export function EmptyDashboardState({ onAddWidgets }: Props) {
  return (
    <div className="pd-empty">
      <div className="pd-empty__visual" aria-hidden>
        <div className="pd-empty__tile pd-empty__tile--a" />
        <div className="pd-empty__tile pd-empty__tile--b" />
        <div className="pd-empty__tile pd-empty__tile--c" />
        <LayoutGrid className="pd-empty__icon" size={28} strokeWidth={1.5} />
      </div>
      <h2>Your command center is empty</h2>
      <p>Add widgets from the library to build a calm morning dashboard — like arranging apps on your home screen.</p>
      {onAddWidgets ? (
        <button type="button" className="pd-empty__btn" onClick={onAddWidgets}>
          <Plus size={16} />
          Browse widgets
        </button>
      ) : null}
    </div>
  );
}
