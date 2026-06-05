import type { WidgetRenderProps } from "../types";
import { mockSystem } from "../mockData";

export function SystemStatusWidget(_props: WidgetRenderProps) {
  const rows = [
    ["Sync", mockSystem.sync],
    ["API", mockSystem.api],
    ["Database", mockSystem.db],
    ["Layout", mockSystem.lastSave],
  ] as const;

  return (
    <div className="pd-widget pd-widget--system">
      <dl className="pd-system-dl">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
