/** Suggestion chips inspired by Open WebUI's Suggestions component (cloud prompts, no local AI). */
export type SuggestionChip = {
  id: string;
  label: string;
  prompt: string;
  description?: string;
};

type Props = {
  label?: string;
  suggestions: SuggestionChip[];
  loading?: boolean;
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  filterText?: string;
  className?: string;
};

export function AISuggestionChips({
  label = "Suggested",
  suggestions,
  loading,
  disabled,
  onSelect,
  filterText = "",
  className = "",
}: Props) {
  const q = filterText.trim().toLowerCase();
  const filtered =
    q.length > 0 && q.length < 500
      ? suggestions.filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.prompt.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q),
        )
      : suggestions;

  if (loading) {
    return (
      <div className={`ai-suggestion-chips ${className}`.trim()}>
        <p className="ai-suggestion-chips__hint">Loading suggestions…</p>
      </div>
    );
  }

  if (filtered.length === 0) return null;

  return (
    <div className={`ai-suggestion-chips ${className}`.trim()}>
      <p className="ai-suggestion-chips__label">{label}</p>
      <div className="ai-suggestion-chips__row">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            className="ai-suggestion-chip"
            title={s.description ?? s.prompt}
            disabled={disabled}
            onClick={() => onSelect(s.prompt)}
          >
            <span className="ai-suggestion-chip__label">{s.label}</span>
            {s.description ? (
              <span className="ai-suggestion-chip__desc">{s.description}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
