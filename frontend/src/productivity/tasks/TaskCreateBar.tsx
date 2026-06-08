import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { Flag, ListTodo } from "lucide-react";

export type CreateKind = "task" | "goal";

export const TASK_CREATE_TITLE_ID = "pd-create-bar-title";

interface Props {
  busy?: boolean;
  focusToken?: number;
  /** Lock to task or goal only (hides the kind switcher). */
  lockedKind?: CreateKind;
  onCreateTask: (fields: { title: string; dueDate?: string | null; notes?: string }) => Promise<string | null>;
  onCreateGoal: (fields: { title: string; targetDate?: string | null; estimateHours?: number }) => void;
}

export function TaskCreateBar({ busy, focusToken = 0, lockedKind, onCreateTask, onCreateGoal }: Props) {
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<CreateKind>(lockedKind ?? "task");
  const effectiveKind = lockedKind ?? kind;
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [estimateHours, setEstimateHours] = useState("4");
  const [saving, setSaving] = useState(false);

  const trimmed = title.trim();
  const canSubmit = Boolean(trimmed) && !saving && !busy;

  useEffect(() => {
    if (lockedKind) setKind(lockedKind);
  }, [lockedKind]);

  useEffect(() => {
    if (focusToken > 0) titleRef.current?.focus();
  }, [focusToken]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    if (effectiveKind === "goal") {
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
    <section className="pd-create-bar" aria-labelledby={`${formId}-label`}>
      <p id={`${formId}-label`} className="pd-create-bar__lead">
        Draft below, then confirm — nothing is added until you click the button.
      </p>
      <form className="pd-create-bar__form" onSubmit={(e) => void submit(e)} noValidate>
        {!lockedKind ? (
          <div className="pd-create-bar__kind" role="tablist" aria-label="Create type">
            <button
              type="button"
              role="tab"
              aria-selected={effectiveKind === "task"}
              className={`pd-create-bar__kind-btn${effectiveKind === "task" ? " pd-create-bar__kind-btn--active" : ""}`}
              onClick={() => setKind("task")}
            >
              <ListTodo size={15} aria-hidden />
              Task
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={effectiveKind === "goal"}
              className={`pd-create-bar__kind-btn${effectiveKind === "goal" ? " pd-create-bar__kind-btn--active" : ""}`}
              onClick={() => setKind("goal")}
            >
              <Flag size={15} aria-hidden />
              Goal
            </button>
          </div>
        ) : null}
        <div className="pd-create-bar__row">
          <input
            ref={titleRef}
            id={TASK_CREATE_TITLE_ID}
            className="pd-create-bar__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={effectiveKind === "goal" ? "Long-term goal…" : "What needs doing?…"}
            disabled={busy || saving}
            aria-label={effectiveKind === "goal" ? "Goal title" : "Task title"}
            autoComplete="off"
          />
          {effectiveKind === "task" ? (
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
        </div>
        {effectiveKind === "task" ? (
          <input
            className="pd-create-bar__notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Notes (optional) — “progress: 40” sets % after you confirm"
            disabled={busy || saving}
            aria-label="Task notes"
          />
        ) : null}
        {trimmed ? (
          <div className="pd-create-bar__preview" role="status">
            <span className="pd-create-bar__preview-label">Ready to add</span>
            <strong>{trimmed}</strong>
            {effectiveKind === "task" && dueDate ? <span> · due {dueDate}</span> : null}
            {effectiveKind === "goal" && targetDate ? <span> · target {targetDate}</span> : null}
          </div>
        ) : null}
        <div className="pd-create-bar__actions">
          <button
            type="submit"
            className="pd-btn pd-btn--primary"
            disabled={!canSubmit}
            aria-busy={saving}
          >
            {saving ? "Adding…" : effectiveKind === "goal" ? "Confirm & add goal" : "Confirm & add task"}
          </button>
          {trimmed ? (
            <button
              type="button"
              className="pd-btn pd-btn--ghost pd-btn--sm"
              disabled={saving}
              onClick={() => {
                setTitle("");
                setDueDate("");
                setTargetDate("");
                setNotes("");
              }}
            >
              Clear draft
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
