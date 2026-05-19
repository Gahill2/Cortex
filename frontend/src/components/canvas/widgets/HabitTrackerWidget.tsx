import { useCallback, useEffect, useState } from "react";
import { usePreferences } from "../../../context/PreferencesContext";
import type { HabitPref } from "../../../lib/preferencesTypes";

const STORAGE_KEY = "cortex-habits";

interface Habit {
  id: string;
  name: string;
  color: string;
  history: Record<string, boolean>; // "YYYY-MM-DD" -> completed
}

const COLORS = ["#5b8dff", "#3be8ad", "#f5a623", "#ff5f5f", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dayLabel(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" });
}

function streak(habit: Habit): number {
  let count = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (habit.history[key]) { count++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return count;
}

function loadHabits(): Habit[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveHabits(h: Habit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

export function HabitTrackerWidget() {
  const { settings, ready, patch } = usePreferences();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const days = last7Days();

  useEffect(() => {
    if (!ready || hydrated) return;
    const fromServer = settings.extraJson?.habits;
    if (Array.isArray(fromServer) && fromServer.length > 0) {
      setHabits(fromServer as Habit[]);
    } else {
      setHabits(loadHabits());
    }
    setHydrated(true);
  }, [ready, settings.extraJson?.habits, hydrated]);

  const persist = useCallback(
    (updated: Habit[]) => {
      setHabits(updated);
      patch({ extraJson: { habits: updated as HabitPref[] } });
      saveHabits(updated);
    },
    [patch],
  );

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const h: Habit = { id: `h_${Date.now()}`, name: newName.trim(), color: newColor, history: {} };
    persist([...habits, h]);
    setNewName(""); setAdding(false);
  };

  const toggle = (habitId: string, day: string) => {
    persist(habits.map((h) => {
      if (h.id !== habitId) return h;
      const next = { ...h.history };
      if (next[day]) delete next[day]; else next[day] = true;
      return { ...h, history: next };
    }));
  };

  const remove = (id: string) => persist(habits.filter((h) => h.id !== id));

  return (
    <div className="habit-widget">
      <div className="habit-header">
        <span className="habit-title">Habits</span>
        <button className="habit-add-btn" onClick={() => setAdding(true)} title="Add habit">+</button>
      </div>

      {adding && (
        <form className="habit-add-form" onSubmit={addHabit}>
          <input className="habit-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Habit name…" autoFocus />
          <div className="habit-color-row">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`habit-color-dot${newColor === c ? " is-active" : ""}`} style={{ background: c }} onClick={() => setNewColor(c)} />
            ))}
          </div>
          <div className="habit-add-actions">
            <button type="submit" className="btn-primary btn-sm" disabled={!newName.trim()}>Add</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {habits.length === 0 && !adding && (
        <p className="habit-empty">No habits yet — add one to start tracking.</p>
      )}

      <div className="habit-grid">
        {/* Day headers */}
        <div className="habit-grid-row habit-grid-row--header">
          <span className="habit-grid-name" />
          {days.map((d) => (
            <span key={d} className={`habit-grid-day${d === today() ? " is-today" : ""}`}>{dayLabel(d)}</span>
          ))}
          <span className="habit-grid-streak">🔥</span>
        </div>

        {habits.map((h) => (
          <div key={h.id} className="habit-grid-row">
            <span className="habit-grid-name" title={h.name}>
              <span className="habit-grid-dot" style={{ background: h.color }} />
              {h.name}
              <button className="habit-remove-btn" onClick={() => remove(h.id)} title="Remove">×</button>
            </span>
            {days.map((d) => (
              <button
                key={d}
                className={`habit-grid-cell${h.history[d] ? " is-done" : ""}`}
                style={h.history[d] ? { background: h.color } : undefined}
                onClick={() => toggle(h.id, d)}
                aria-label={`${h.name} ${d}`}
              />
            ))}
            <span className="habit-grid-streak">{streak(h) || ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
