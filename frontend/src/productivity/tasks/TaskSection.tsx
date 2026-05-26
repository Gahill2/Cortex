interface Props {
  title: string;
  count?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TaskSection({ title, count, collapsed, onToggleCollapse }: Props) {
  return (
    <div className={`pd-task-section${collapsed ? " pd-task-section--collapsed" : ""}`}>
      <button
        type="button"
        className="pd-task-section__head"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        <span className="pd-task-section__title">{title}</span>
        {count !== undefined ? <span className="pd-task-section__count">{count}</span> : null}
      </button>
    </div>
  );
}
