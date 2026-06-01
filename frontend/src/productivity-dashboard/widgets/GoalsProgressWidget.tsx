import type { WidgetRenderProps } from "../types";
import { PdProgressBar } from "../../components/ui/PdProgressBar";
import { PdBadge } from "../../components/ui/PdBadge";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";
import { useUiCustomization } from "../../hooks/useUiCustomization";
import { goalProgress } from "../../lib/uiCustomization";

export function GoalsProgressWidget(props: WidgetRenderProps) {
  const title = (props.settings.title as string) || "Goals";
  const { goals } = useUiCustomization();
  const active = goals.filter((g) => !g.done).slice(0, 4);

  return (
    <div className="pd-widget pd-widget--goals">
      <PdSectionHeader title={title} />
      {active.length === 0 ? (
        <p className="pd-widget-empty">No active goals — add them on the Tasks page.</p>
      ) : (
        active.map((g) => {
          const pct = goalProgress(g);
          const tone = pct >= 75 ? "success" : pct >= 40 ? "accent" : "warning";
          return (
            <article key={g.id} className="pd-goal-card">
              <div className="pd-goal-card__top">
                <h4>{g.text}</h4>
                <PdBadge tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "neutral"}>
                  {pct}%
                </PdBadge>
              </div>
              <div className="pd-goal-card__progress">
                <PdProgressBar value={pct} tone={tone === "warning" ? "warning" : "accent"} />
                <span className="pd-goal-card__pct">{pct}%</span>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
