import { useUiCustomization } from "../../hooks/useUiCustomization";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  SURFACE_OPTIONS,
} from "../../lib/uiCustomization";

export function UiCustomizationSettings() {
  const { ui, patchUi } = useUiCustomization();

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Layout &amp; color</h2>
      <p className="settings-section-desc">
        Font and text size are on the Home dashboard toolbar. Density, surface, and accent apply across
        the app.
      </p>

      <p className="settings-label">Spacing density</p>
      <div className="appearance-seg" role="group" aria-label="UI density">
        {DENSITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`appearance-seg__btn${ui.density === opt.id ? " appearance-seg__btn--active" : ""}`}
            onClick={() => patchUi({ density: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="settings-label">Surface tone</p>
      <div className="appearance-seg appearance-seg--wrap" role="group" aria-label="Surface tone">
        {SURFACE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`appearance-seg__btn${ui.surfaceTone === opt.id ? " appearance-seg__btn--active" : ""}`}
            onClick={() => patchUi({ surfaceTone: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="settings-label">Accent</p>
      <div className="accent-swatch-row" role="group" aria-label="Accent color">
        {ACCENT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`accent-swatch${ui.accent === opt.id ? " accent-swatch--active" : ""}`}
            style={{ background: opt.hex }}
            title={opt.label}
            onClick={() => patchUi({ accent: opt.id })}
          >
            {ui.accent === opt.id ? <span className="accent-swatch-check">✓</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
