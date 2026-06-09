import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences } from "../../../context/PreferencesContext";

const STORAGE_KEY = "cortex-dashboard-quick-note";

export function NotesWidget({ compact }: { compact?: boolean }) {
  const { settings, patch, ready } = usePreferences();
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);

  const serverNote =
    typeof settings.extraJson?.quickNote === "string"
      ? (settings.extraJson.quickNote as string)
      : null;

  // Adopt the account copy on load, and on later cross-device updates unless typing here.
  useEffect(() => {
    if (!ready || serverNote === null) return;
    if (!hydratedRef.current || document.activeElement !== areaRef.current) {
      setText(serverNote);
    }
    hydratedRef.current = true;
  }, [ready, serverNote]);

  const persist = useCallback(
    (value: string) => {
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* ignore */
      }
      if (ready) {
        patch({ extraJson: { ...(settings.extraJson ?? {}), quickNote: value } });
      }
    },
    [ready, patch, settings.extraJson],
  );

  return (
    <div className="widget widget--notes" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--notes__head">
        <span className="widget--notes__pin" aria-hidden>
          📌
        </span>
        <span>Quick note</span>
      </div>
      <textarea
        ref={areaRef}
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
