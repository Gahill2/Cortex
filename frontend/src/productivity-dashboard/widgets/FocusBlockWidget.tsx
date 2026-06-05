import type { WidgetRenderProps } from "../types";

export function FocusBlockWidget(_props: WidgetRenderProps) {
  return (
    <div className="pd-widget pd-widget--focus">
      <p className="pd-widget--focus__label">Next focus</p>
      <h3 className="pd-widget--focus__title">Dashboard polish</h3>
      <p className="pd-widget--focus__meta">45 min · Deep work</p>
      <button type="button" className="pd-widget--focus__btn">
        Start focus
      </button>
    </div>
  );
}
