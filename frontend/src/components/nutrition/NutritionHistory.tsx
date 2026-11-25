import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteNutritionEntry,
  updateNutritionEntry,
  type NutritionEntry,
} from "../../api/nutrition";

type Props = {
  entries: NutritionEntry[];
  loading?: boolean;
  onChanged: () => void;
};

export function NutritionHistory({ entries, loading, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<NutritionEntry>>({});
  const [busy, setBusy] = useState(false);

  const startEdit = (entry: NutritionEntry) => {
    setEditingId(entry.id);
    setDraft(entry);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    try {
      await updateNutritionEntry(editingId, draft);
      setEditingId(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this meal entry?")) return;
    setBusy(true);
    try {
      await deleteNutritionEntry(id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="nutrition-card">
      <h2 className="nutrition-card__title">Meal history</h2>
      {loading ? <p className="nutrition-muted">Loading entries…</p> : null}
      {!loading && entries.length === 0 ? <p className="nutrition-muted">No meals logged today.</p> : null}
      <div className="nutrition-history-list">
        {entries.map((entry) => {
          const time = new Date(entry.consumedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const editing = editingId === entry.id;
          return (
            <article key={entry.id} className="nutrition-history-item">
              <div className="nutrition-history-main">
                <div className="nutrition-history-time">{time}</div>
                <div>
                  <div className="nutrition-history-title">{entry.normalizedDescription}</div>
                  <div className="nutrition-history-macros">
                    {entry.calories} cal · P {entry.proteinG}g · C {entry.carbsG}g · F {entry.fatG}g
                  </div>
                  <div className="nutrition-history-meta">Confidence: {entry.confidence}</div>
                </div>
              </div>
              {editing ? (
                <div className="nutrition-history-edit">
                  <input
                    type="number"
                    value={draft.calories ?? entry.calories}
                    onChange={(ev) => setDraft({ ...draft, calories: Number(ev.target.value) })}
                  />
                  <button type="button" className="nutrition-btn nutrition-btn--primary" onClick={() => void saveEdit()} disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="nutrition-btn nutrition-btn--ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="nutrition-history-actions">
                  <button type="button" aria-label="Edit" onClick={() => startEdit(entry)}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" aria-label="Delete" onClick={() => void remove(entry.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
