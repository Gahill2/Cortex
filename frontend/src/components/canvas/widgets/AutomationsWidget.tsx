import { useEffect, useState } from "react";
import type { Tab } from "../../../App";
import { api } from "../../../api/client";
import type { IntegrationItem } from "../../IntegrationsPanel";

/** Automation-flavored integrations shown on the board, in display order. */
const AUTOMATION_IDS = ["n8n", "openclaw", "ollama", "anthropic", "kimi", "notion", "canva", "firebase"];

export function AutomationsWidget({
  onNavigate,
  compact,
}: {
  onNavigate?: (t: Tab) => void;
  compact?: boolean;
}) {
  const [items, setItems] = useState<IntegrationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data?: { items?: IntegrationItem[] } }>("/integrations/status")
      .then((r) => {
        if (cancelled) return;
        const all = r.data?.data?.items ?? [];
        const ranked = all
          .filter((i) => AUTOMATION_IDS.includes(i.id))
          .sort(
            (a, b) =>
              Number(b.connected) - Number(a.connected) ||
              AUTOMATION_IDS.indexOf(a.id) - AUTOMATION_IDS.indexOf(b.id),
          );
        setItems(ranked);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const limit = compact ? 2 : 3;

  return (
    <div className="widget widget--automations" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--automations__head">
        <span>Automations</span>
        {onNavigate && (
          <button
            type="button"
            className="widget--automations__link"
            onClick={() => onNavigate("settings")}
          >
            Manage
          </button>
        )}
      </div>
      {failed ? (
        <p className="widget-empty">Couldn’t load integrations.</p>
      ) : items === null ? (
        <p className="widget-empty">Checking integrations…</p>
      ) : items.length === 0 ? (
        <p className="widget-empty">No automations configured — connect one in Settings.</p>
      ) : (
        <ul className="widget--automations__list">
          {items.slice(0, limit).map((f) => (
            <li key={f.id} className="widget--automations__row">
              <div>
                <span className="widget--automations__label">{f.name}</span>
                {!compact && f.detail && (
                  <span className="widget--automations__detail">{f.detail}</span>
                )}
              </div>
              <span
                className={`widget--automations__badge${f.connected ? " widget--automations__badge--active" : ""}`}
              >
                {f.connected ? "Active" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
