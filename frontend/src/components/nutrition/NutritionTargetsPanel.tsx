import { FormEvent, useEffect, useState } from "react";
import { updateNutritionTargets, type NutritionTargets } from "../../api/nutrition";

type Props = {
  targets: NutritionTargets;
  onUpdated: (targets: NutritionTargets) => void;
};

export function NutritionTargetsPanel({ targets, onUpdated }: Props) {
  const [draft, setDraft] = useState(targets);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(targets);
  }, [targets]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const next = await updateNutritionTargets(draft);
      onUpdated(next);
      setMessage("Targets saved.");
    } catch {
      setMessage("Could not save targets.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="nutrition-card">
      <h2 className="nutrition-card__title">Daily targets</h2>
      <form className="nutrition-targets-form" onSubmit={(ev) => void onSubmit(ev)}>
        {([
          ["calorieTarget", "Calories"],
          ["proteinTargetG", "Protein (g)"],
          ["carbsTargetG", "Carbs (g)"],
          ["fatTargetG", "Fat (g)"],
          ["fiberTargetG", "Fiber (g)"],
        ] as const).map(([key, label]) => (
          <label key={key} className="nutrition-field">
            <span>{label}</span>
            <input
              type="number"
              min={0}
              value={draft[key]}
              onChange={(ev) => setDraft({ ...draft, [key]: Number(ev.target.value) })}
            />
          </label>
        ))}
        <button type="submit" className="nutrition-btn nutrition-btn--primary" disabled={saving}>
          Save targets
        </button>
        {message ? <p className="nutrition-muted">{message}</p> : null}
      </form>
    </section>
  );
}
