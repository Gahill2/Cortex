import { useUiCustomization } from "../../hooks/useUiCustomization";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  SURFACE_OPTIONS,
} from "../../lib/uiCustomization";

/** Density, surface, accent — edit mode toolbar (typography lives in DashboardTypographyToolbar). */
export function DashboardCustomizeStrip() {
  const { ui, patchUi } = useUiCustomization();

  return (
    <div className="dashboard-customize-strip" aria-label="Dashboard appearance">
      <span className="dashboard-customize-strip__label">Theme</span>
      <div className="dashboard-customize-strip__group" role="group" aria-label="Density">
        {DENSITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dashboard-customize-strip__chip${ui.density === opt.id ? " is-active" : ""}`}
            title={`Density: ${opt.label}`}
            onClick={() => patchUi({ density: opt.id })}
          >
            {opt.label.slice(0, 1)}
          </button>
        ))}
      </div>
      <span className="dashboard-customize-strip__sep" aria-hidden />
      <div className="dashboard-customize-strip__group" role="group" aria-label="Surface">
        {SURFACE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dashboard-customize-strip__chip${ui.surfaceTone === opt.id ? " is-active" : ""}`}
            title={`Surface: ${opt.label}`}
            onClick={() => patchUi({ surfaceTone: opt.id })}
          >
            {opt.label.slice(0, 1)}
          </button>
        ))}
      </div>
      <span className="dashboard-customize-strip__sep" aria-hidden />
      <div className="dashboard-customize-strip__swatches" role="group" aria-label="Accent">
        {ACCENT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dashboard-customize-strip__swatch${ui.accent === opt.id ? " is-active" : ""}`}
            style={{ background: opt.hex }}
            title={opt.label}
            onClick={() => patchUi({ accent: opt.id })}
          />
        ))}
      </div>
    </div>
  );
}
