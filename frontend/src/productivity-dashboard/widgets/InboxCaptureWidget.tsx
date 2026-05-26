import type { WidgetRenderProps } from "../types";

export function InboxCaptureWidget(_props: WidgetRenderProps) {
  return (
    <div className="pd-widget pd-widget--inbox-capture">
      <label className="pd-inbox-capture">
        <span className="pd-inbox-capture__label">Capture to inbox</span>
        <input type="text" placeholder="Task or note…" />
        <button type="button">Add</button>
      </label>
    </div>
  );
}
