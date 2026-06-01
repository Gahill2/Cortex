import { FormEvent, useState } from "react";

interface Props {
  busy?: boolean;
  onAdd: (text: string) => Promise<string | null>;
}

export function TasksCalendarQuickAdd({ busy = false, onAdd }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    const id = await onAdd(value);
    if (id) setText("");
    setSaving(false);
  };

  return (
    <form className="tcc-quick-add" onSubmit={(e) => void submit(e)}>
      <input
        type="text"
        className="tcc-quick-add-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Add task… e.g. "Review PR by Friday"'
        disabled={busy || saving}
        aria-label="Add task in plain language"
      />
      <button type="submit" className="teams-btn teams-btn--primary teams-btn--sm" disabled={busy || saving || !text.trim()}>
        {saving ? "Adding…" : "Confirm add"}
      </button>
    </form>
  );
}
