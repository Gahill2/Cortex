import type { WidgetRenderProps } from "../types";
import { mockAutomations } from "../mockData";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

export function AutomationsWidget(_props: WidgetRenderProps) {
  return (
    <div className="pd-widget pd-widget--automations">
      <PdSectionHeader title="Actions" />
      <ul className="pd-action-list">
        {mockAutomations.map((a) => (
          <li key={a.id}>
            <button type="button" className="pd-action-row">
              <span className={`pd-action-row__dot pd-action-row__dot--${a.status}`} />
              <span className="pd-action-row__label">{a.label}</span>
              {a.shortcut ? <kbd>{a.shortcut}</kbd> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
