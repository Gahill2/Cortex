import { useUiCustomization } from "../../hooks/useUiCustomization";
import { HOME_FONT_OPTIONS } from "../../lib/uiCustomization";
import { TextSizePresetPicker } from "./TextSizePresetPicker";

/** Font + text size — always on the home dashboard toolbar (not Settings). */
export function DashboardTypographyToolbar() {
  const { ui, patchUi } = useUiCustomization();
  return (
    <div className="dashboard-typography-toolbar" aria-label="Font and text size">
      <div className="dashboard-typography-toolbar__fonts" role="group" aria-label="Font">
        {HOME_FONT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dashboard-typography-toolbar__font${ui.homeFont === opt.id ? " is-active" : ""}`}
            style={{ fontFamily: opt.stack }}
            title={`Font: ${opt.label}`}
            onClick={() => patchUi({ homeFont: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="dashboard-typography-toolbar__sep" aria-hidden />
      <TextSizePresetPicker
        compact
        textSizePx={ui.textSizePx}
        textScale={ui.textScale}
        onTextSizePxChange={(px) => patchUi({ textSizePx: px })}
        onTextScaleChange={(scale) => patchUi({ textScale: scale })}
      />
    </div>
  );
}
