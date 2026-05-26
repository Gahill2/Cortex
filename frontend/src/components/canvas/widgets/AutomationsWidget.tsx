import type { Tab } from "../../../App";

const FLOWS = [
  { id: "mcp", label: "MCP tools", status: "Ready", detail: "Browser · Linear · Figma" },
  { id: "sync", label: "Vault sync", status: "Idle", detail: "Obsidian watcher" },
  { id: "ai", label: "AI actions", status: "Active", detail: "2 suggestions" },
];

export function AutomationsWidget({
  onNavigate,
  compact,
}: {
  onNavigate?: (t: Tab) => void;
  compact?: boolean;
}) {
  return (
    <div className="widget widget--automations" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--automations__head">
        <span>Automations</span>
        {onNavigate && (
          <button
            type="button"
            className="widget--automations__link"
            onClick={() => onNavigate("ai")}
          >
            Open AI
          </button>
        )}
      </div>
      <ul className="widget--automations__list">
        {FLOWS.slice(0, compact ? 2 : 3).map((f) => (
          <li key={f.id} className="widget--automations__row">
            <div>
              <span className="widget--automations__label">{f.label}</span>
              {!compact && <span className="widget--automations__detail">{f.detail}</span>}
            </div>
            <span className={`widget--automations__badge widget--automations__badge--${f.status.toLowerCase()}`}>
              {f.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
