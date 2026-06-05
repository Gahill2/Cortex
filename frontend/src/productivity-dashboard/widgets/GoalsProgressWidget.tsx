import type { WidgetRenderProps } from "../types";
import { mockGoals } from "../mockData";
import { PdProgressBar } from "../../components/ui/PdProgressBar";
import { PdBadge } from "../../components/ui/PdBadge";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

const statusLabel = {
  on_track: { label: "On track", tone: "success" as const },
  at_risk: { label: "At risk", tone: "warning" as const },
  paused: { label: "Paused", tone: "neutral" as const },
  complete: { label: "Complete", tone: "success" as const },
};

export function GoalsProgressWidget(props: WidgetRenderProps) {
  const title = (props.settings.title as string) || "Goals";
  return (
    <div className="pd-widget pd-widget--goals">
      <PdSectionHeader title={title} />
      {mockGoals.map((g) => {
        const st = statusLabel[g.status];
        return (
          <article key={g.id} className="pd-goal-card">
            <div className="pd-goal-card__top">
              <h4>{g.title}</h4>
              <PdBadge tone={st.tone}>{st.label}</PdBadge>
            </div>
            <div className="pd-goal-card__progress">
              <PdProgressBar value={g.progress} tone={g.status === "at_risk" ? "warning" : "accent"} />
              <span className="pd-goal-card__pct">{g.progress}%</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
