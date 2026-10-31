import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  exportNutritionLog,
  getNutritionDashboard,
  localDateIso,
  type MacroTotals,
  type NutritionEntry,
  type NutritionTargets,
  type WeeklyNutrition,
} from "../api/nutrition";
import { NutritionQuickLog } from "../components/nutrition/NutritionQuickLog";
import { NutritionProgress } from "../components/nutrition/NutritionProgress";
import { NutritionHistory } from "../components/nutrition/NutritionHistory";
import { NutritionTrends } from "../components/nutrition/NutritionTrends";
import { NutritionTargetsPanel } from "../components/nutrition/NutritionTargetsPanel";

const emptyTotals = (): MacroTotals => ({
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0,
  entryCount: 0,
});

export function NutritionPage() {
  const today = useMemo(() => localDateIso(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<MacroTotals>(emptyTotals());
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyNutrition | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await getNutritionDashboard(today);
      setTotals(dashboard.totals);
      setTargets(dashboard.targets);
      setEntries(dashboard.entries);
      setWeekly(dashboard.weekly);
    } catch {
      setTotals(emptyTotals());
      setEntries([]);
      setWeekly(null);
      setError("Could not load nutrition data. Check that the API is running and migrations are applied.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const onExport = async () => {
    setExporting(true);
    try {
      const from = weekly?.days[0]?.date ?? today;
      const blob = await exportNutritionLog(from, today);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutrition-log-${from}-to-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="nutrition-page">
      <header className="nutrition-header">
        <div>
          <h1>Nutrition</h1>
          <p className="nutrition-muted">Log meals by voice or text, review AI estimates, and track daily macros.</p>
        </div>
        <button type="button" className="nutrition-btn nutrition-btn--ghost" onClick={() => void onExport()} disabled={exporting || loading}>
          <Download size={16} />
          Export nutrition log
        </button>
      </header>

      {error ? <p className="nutrition-error nutrition-page-error">{error}</p> : null}

      <div className="nutrition-grid">
        <div className="nutrition-grid__main">
          <NutritionQuickLog onSaved={() => void refresh()} />
          {targets ? <NutritionProgress totals={totals} targets={targets} loading={loading} /> : null}
          <NutritionHistory entries={entries} loading={loading} onChanged={() => void refresh()} />
        </div>
        <div className="nutrition-grid__side">
          <NutritionTrends weekly={weekly} loading={loading} />
          {targets ? (
            <NutritionTargetsPanel
              targets={targets}
              onUpdated={(next) => {
                setTargets(next);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
