import { TccIconCalendarPlus, TccIconPlus, TccIconSearch } from "./TccIcons";

interface Props {
  search: string;
  onSearchChange: (q: string) => void;
  onNewTask: () => void;
  onNewEvent: () => void;
}

export function TasksCalendarHeader({
  search,
  onSearchChange,
  onNewTask,
  onNewEvent,
}: Props) {
  return (
    <header className="tcc-header">
      <div className="tcc-header-titles">
        <h1 className="tcc-title">Tasks &amp; Calendar</h1>
        <p className="tcc-subtitle">Plan your day, track priorities, and stay ahead.</p>
      </div>
      <div className="tcc-header-actions">
        <label className="tcc-search">
          <TccIconSearch />
          <input
            type="search"
            placeholder="Search tasks and events…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks and events"
          />
        </label>
        <button type="button" className="teams-btn teams-btn--ghost" onClick={onNewTask}>
          <TccIconPlus />
          New Task
        </button>
        <button type="button" className="teams-btn teams-btn--primary" onClick={onNewEvent}>
          <TccIconCalendarPlus />
          New Event
        </button>
      </div>
    </header>
  );
}
