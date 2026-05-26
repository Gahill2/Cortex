import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cortex-dashboard-quick-note";

export function NotesWidget({ compact }: { compact?: boolean }) {
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setText(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="widget widget--notes" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--notes__head">
        <span className="widget--notes__pin" aria-hidden>
          📌
        </span>
        <span>Quick note</span>
      </div>
      <textarea
        className="widget--notes__area"
        rows={compact ? 3 : 5}
        placeholder="Jot something down…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          persist(e.target.value);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
