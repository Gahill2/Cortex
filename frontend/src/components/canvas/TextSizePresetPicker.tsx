import {
  clampTextSizePx,
  snapTextScale,
  TEXT_SCALE_PRESETS,
  TEXT_SIZE_PRESETS,
  textScaleToPercent,
} from "../../lib/uiCustomization";

interface Props {
  textSizePx: number;
  textScale: number;
  onTextSizePxChange: (px: number) => void;
  onTextScaleChange: (scale: number) => void;
  className?: string;
  compact?: boolean;
  inheritLabel?: string;
  inheritActive?: boolean;
  onInherit?: () => void;
}

/** Compact px dropdown + % scale dropdown (separate values). */
export function TextSizePresetPicker({
  textSizePx,
  textScale,
  onTextSizePxChange,
  onTextScaleChange,
  className = "",
  compact = true,
  inheritLabel,
  inheritActive,
  onInherit,
}: Props) {
  const sizePx = clampTextSizePx(textSizePx);
  const scalePct = textScaleToPercent(textScale);

  return (
    <div
      className={`text-size-control${compact ? " text-size-control--compact" : ""}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="Text size and scale"
    >
      {inheritLabel && onInherit ? (
        <button
          type="button"
          className={`text-size-control__inherit${inheritActive ? " is-active" : ""}`}
          onClick={onInherit}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {inheritLabel}
        </button>
      ) : null}
      <label className="text-size-control__field">
        <span className="text-size-control__field-label">Size</span>
        <select
          className="text-size-control__dropdown text-size-control__dropdown--size"
          value={String(sizePx)}
          disabled={inheritActive}
          onChange={(e) => onTextSizePxChange(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Text size in pixels"
        >
          {TEXT_SIZE_PRESETS.map((p) => (
            <option key={p.px} value={p.px}>
              {p.px}px
            </option>
          ))}
        </select>
      </label>
      <label className="text-size-control__field">
        <span className="text-size-control__field-label">Scale</span>
        <select
          className="text-size-control__dropdown text-size-control__dropdown--scale"
          value={String(snapTextScale(textScale))}
          disabled={inheritActive}
          onChange={(e) => onTextScaleChange(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Text scale percentage"
        >
          {TEXT_SCALE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {!compact ? (
        <span className="text-size-control__hint" aria-hidden>
          {sizePx}px @ {scalePct}%
        </span>
      ) : null}
    </div>
  );
}
