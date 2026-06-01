import { Target } from "lucide-react";
import type { Tab } from "../../../App";
import { useUiCustomization } from "../../../hooks/useUiCustomization";
import { goalProgress } from "../../../lib/uiCustomization";

export function GoalsWidget({
  onNavigate,
  compact,
}: {
  onNavigate?: (t: Tab) => void;
  compact?: boolean;
}) {
  const { goals } = useUiCustomization();
  const active = goals.filter((g) => !g.done);
  const limit = compact ? 2 : 4;

  return (
    <div
      className="widget widget--goals"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onNavigate?.("tasks")}
      role={onNavigate ? "button" : undefined}
      tabIndex={onNavigate ? 0 : undefined}
    >
      <div className="widget-label widget-label--icon">
        <Target size={16} strokeWidth={1.75} aria-hidden />
        <span>Goals</span>
      </div>
      {active.length === 0 ? (
        <p className="widget-empty">No active goals — add them on Tasks.</p>
      ) : (
        <ul className="widget-goals-list">
          {active.slice(0, limit).map((g) => {
            const pct = goalProgress(g);
            return (
              <li key={g.id} className="widget-goals-row">
                <span className="widget-goals-row__title">{g.text}</span>
                <span className="widget-goals-row__pct">{pct}%</span>
                <div className="widget-goals-row__bar" aria-hidden>
                  <div className="widget-goals-row__fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {active.length > limit ? (
        <p className="widget--calendar__foot">+{active.length - limit} more</p>
      ) : null}
    </div>
  );
}
