import type { MacroTotals, NutritionTargets } from "../../api/nutrition";

type Props = {
  totals: MacroTotals;
  targets: NutritionTargets;
  loading?: boolean;
};

function ProgressBar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="nutrition-progress-row">
      <div className="nutrition-progress-head">
        <span>{label}</span>
        <span>
          {Math.round(value)}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="nutrition-progress-track">
        <div className="nutrition-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NutritionProgress({ totals, targets, loading }: Props) {
  return (
    <section className="nutrition-card">
      <h2 className="nutrition-card__title">Today&apos;s progress</h2>
      {loading ? <p className="nutrition-muted">Loading totals…</p> : null}
      <ProgressBar label="Calories" value={totals.calories} target={targets.calorieTarget} unit="" />
      <ProgressBar label="Protein" value={totals.proteinG} target={targets.proteinTargetG} unit="g" />
      <ProgressBar label="Carbs" value={totals.carbsG} target={targets.carbsTargetG} unit="g" />
      <ProgressBar label="Fat" value={totals.fatG} target={targets.fatTargetG} unit="g" />
      <ProgressBar label="Fiber" value={totals.fiberG} target={targets.fiberTargetG} unit="g" />
    </section>
  );
}
