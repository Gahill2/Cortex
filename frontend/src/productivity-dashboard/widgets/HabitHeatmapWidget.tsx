import { useState } from "react";
import type { WidgetRenderProps } from "../types";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

export function HabitHeatmapWidget(_props: WidgetRenderProps) {
  const [mode, setMode] = useState<"week" | "month">("month");
  const cells = Array.from({ length: mode === "week" ? 7 : 28 }, (_, i) => (i * 17) % 5);

  return (
    <div className="pd-widget pd-widget--heatmap">
      <PdSectionHeader
        title="Habit heatmap"
        action={
          <div className="pd-segment">
            <button type="button" className={mode === "week" ? "is-active" : ""} onClick={() => setMode("week")}>
              Week
            </button>
            <button type="button" className={mode === "month" ? "is-active" : ""} onClick={() => setMode("month")}>
              Month
            </button>
          </div>
        }
      />
      <div className={`pd-heatmap pd-heatmap--${mode}`}>
        {cells.map((level, i) => (
          <span key={i} className={`pd-heatmap__cell pd-heatmap__cell--${level}`} />
        ))}
      </div>
    </div>
  );
}
