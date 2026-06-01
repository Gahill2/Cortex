import { FormEvent, useState } from "react";
import { Flag, ListTodo } from "lucide-react";

export type CreateKind = "task" | "goal";

interface Props {
  busy?: boolean;
  onCreateTask: (fields: { title: string; dueDate?: string | null; notes?: string }) => Promise<string | null>;
  onCreateGoal: (fields: { title: string; targetDate?: string | null; estimateHours?: number }) => void;
}

export function TaskCreateBar({ busy, onCreateTask, onCreateGoal }: Props) {
  const [kind, setKind] = useState<CreateKind>("task");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [estimateHours, setEstimateHours] = useState("4");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    if (kind === "goal") {
      onCreateGoal({
        title: trimmed,
        targetDate: targetDate || null,
        estimateHours: Math.max(0.5, Number(estimateHours) || 4),
      });
      setTitle("");
      setTargetDate("");
      setNotes("");
    } else {
      const id = await onCreateTask({
        title: trimmed,
        dueDate: dueDate || null,
        notes: notes.trim() || undefined,
      });
      if (id) {
        setTitle("");
        setDueDate("");
        setNotes("");
      }
    }
    setSaving(false);
  };

  return (
    <form className="pd-create-bar" onSubmit={(e) => void submit(e)}>
      <div className="pd-create-bar__kind" role="tablist" aria-label="Create type">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "task"}
          className={`pd-create-bar__kind-btn${kind === "task" ? " pd-create-bar__kind-btn--active" : ""}`}
          onClick={() => setKind("task")}
        >
          <ListTodo size={15} aria-hidden />
          Task
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "goal"}
          className={`pd-create-bar__kind-btn${kind === "goal" ? " pd-create-bar__kind-btn--active" : ""}`}
          onClick={() => setKind("goal")}
        >
          <Flag size={15} aria-hidden />
          Goal
        </button>
      </div>
      <div className="pd-create-bar__row">
        <input
          className="pd-create-bar__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "goal" ? "Long-term goal (no due date required)…" : "What needs doing?…"}
          disabled={busy || saving}
          aria-label={kind === "goal" ? "Goal title" : "Task title"}
        />
        {kind === "task" ? (
          <label className="pd-create-bar__date">
            <span className="pd-create-bar__date-label">Due</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={busy || saving}
              aria-label="Due date (optional)"
            />
          </label>
        ) : (
          <>
            <label className="pd-create-bar__date">
              <span className="pd-create-bar__date-label">Target</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={busy || saving}
                aria-label="Target date (optional)"
              />
            </label>
            <label className="pd-create-bar__date pd-create-bar__date--hours">
              <span className="pd-create-bar__date-label">Est. h</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                disabled={busy || saving}
                aria-label="Estimated hours"
              />
            </label>
          </>
        )}
        <button type="submit" className="pd-btn pd-btn--primary pd-btn--sm" disabled={busy || saving || !title.trim()}>
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {kind === "task" ? (
        <input
          className="pd-create-bar__notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — add “progress: 40” to set your own %"
          disabled={busy || saving}
          aria-label="Task notes"
        />
      ) : null}
    </form>
  );
}
