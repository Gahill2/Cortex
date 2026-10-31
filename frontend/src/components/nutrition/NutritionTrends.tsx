import type { WeeklyNutrition } from "../../api/nutrition";

type Props = {
  weekly: WeeklyNutrition | null;
  loading?: boolean;
};

function TrendBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="nutrition-trend-row">
      <span className="nutrition-trend-label">{label}</span>
      <div className="nutrition-trend-track">
        <div className="nutrition-trend-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="nutrition-trend-value">{Math.round(value)}</span>
    </div>
  );
}

export function NutritionTrends({ weekly, loading }: Props) {
  const maxCalories = weekly ? Math.max(...weekly.days.map((d) => d.totals.calories), 1) : 1;

  return (
    <section className="nutrition-card">
      <h2 className="nutrition-card__title">7-day trends</h2>
      {loading ? <p className="nutrition-muted">Loading trends…</p> : null}
      {weekly ? (
        <>
          <div className="nutrition-trend-days">
            {weekly.days.map((d) => (
              <div key={d.date} className="nutrition-trend-day">
                <span>{d.date.slice(5)}</span>
                <strong>{d.totals.calories}</strong>
              </div>
            ))}
          </div>
          <TrendBar label="Avg calories" value={weekly.averages.calories} max={maxCalories} />
          <TrendBar label="Avg protein" value={weekly.averages.proteinG} max={200} />
          <TrendBar label="Avg carbs" value={weekly.averages.carbsG} max={350} />
          <TrendBar label="Avg fat" value={weekly.averages.fatG} max={120} />
          <p className="nutrition-muted">
            Based on {weekly.averages.daysWithEntries} day(s) with logged meals in the last week.
          </p>
        </>
      ) : null}
    </section>
  );
}
