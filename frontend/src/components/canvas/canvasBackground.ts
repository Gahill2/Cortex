import { WALLPAPER_PRESETS } from "../../hooks/useWallpaper";

export type CanvasBackgroundKind = "default" | "solid" | "gradient" | "image" | "ambient";

export interface CanvasBackground {
  kind: CanvasBackgroundKind;
  /** CSS color, gradient, or url(...) / data URL */
  value: string;
  presetId?: string;
}

export const CANVAS_BG_STORAGE_KEY = "cortex-canvas-background";

export const DEFAULT_CANVAS_BACKGROUND: CanvasBackground = {
  kind: "default",
  value: "",
  presetId: "default",
};

export const CANVAS_SOLID_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "default", label: "Theme", value: "" },
  { id: "ink", label: "Ink", value: "#0e0e12" },
  { id: "charcoal", label: "Charcoal", value: "#16161c" },
  { id: "slate", label: "Slate", value: "#1c2230" },
  { id: "forest", label: "Forest", value: "#121a16" },
  { id: "wine", label: "Wine", value: "#1a1018" },
  { id: "sand", label: "Sand", value: "#1e1a14" },
  { id: "paper", label: "Paper", value: "#e8e6e1" },
];

/** Gradients from app wallpaper presets (excluding none/custom). */
export const CANVAS_GRADIENT_PRESETS = WALLPAPER_PRESETS.filter(
  (p) => p.id !== "none" && p.id !== "custom" && p.value
);

/** Color set driving the three drifting ambient layers. */
export interface AmbientPalette {
  base: string;
  c1: string;
  c2: string;
  c3: string;
}

export interface AmbientPreset extends AmbientPalette {
  id: string;
  label: string;
  /** Static gradient standing in for the animation in picker swatches. */
  preview: string;
  /** Palette follows the local time of day. */
  adaptive?: boolean;
}

export const CANVAS_AMBIENT_PRESETS: AmbientPreset[] = [
  {
    id: "aurora",
    label: "Aurora",
    base: "#0a0d14",
    c1: "rgba(91, 141, 255, 0.45)",
    c2: "rgba(59, 232, 173, 0.32)",
    c3: "rgba(124, 77, 255, 0.26)",
    preview: "linear-gradient(135deg, #0a0d14 0%, #1c2e58 48%, #1d5a4c 100%)",
  },
  {
    id: "nebula",
    label: "Nebula",
    base: "#0d0a14",
    c1: "rgba(168, 85, 247, 0.40)",
    c2: "rgba(236, 72, 153, 0.28)",
    c3: "rgba(56, 189, 248, 0.20)",
    preview: "linear-gradient(135deg, #0d0a14 0%, #3a1d57 50%, #4d1b34 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    base: "#120c0a",
    c1: "rgba(249, 115, 22, 0.34)",
    c2: "rgba(245, 166, 35, 0.26)",
    c3: "rgba(255, 95, 95, 0.20)",
    preview: "linear-gradient(135deg, #120c0a 0%, #4f2a14 50%, #4d1f1c 100%)",
  },
  {
    id: "horizon",
    label: "Horizon",
    adaptive: true,
    base: "#0b0e16",
    c1: "rgba(91, 141, 255, 0.40)",
    c2: "rgba(59, 232, 173, 0.26)",
    c3: "rgba(245, 166, 35, 0.18)",
    preview: "linear-gradient(135deg, #16263e 0%, #4d3a52 55%, #53291f 100%)",
  },
];

/** Horizon palette by local hour: dawn, day, dusk, night. */
export function ambientHorizonPalette(hour: number): AmbientPalette {
  if (hour >= 5 && hour < 9) {
    return {
      base: "#11101c",
      c1: "rgba(251, 146, 60, 0.34)",
      c2: "rgba(244, 114, 182, 0.26)",
      c3: "rgba(91, 141, 255, 0.22)",
    };
  }
  if (hour >= 9 && hour < 17) {
    return {
      base: "#0c1220",
      c1: "rgba(91, 141, 255, 0.42)",
      c2: "rgba(56, 189, 248, 0.30)",
      c3: "rgba(59, 232, 173, 0.20)",
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      base: "#140e18",
      c1: "rgba(249, 115, 22, 0.34)",
      c2: "rgba(217, 70, 147, 0.28)",
      c3: "rgba(99, 102, 241, 0.24)",
    };
  }
  return {
    base: "#070a12",
    c1: "rgba(99, 102, 241, 0.34)",
    c2: "rgba(45, 212, 191, 0.20)",
    c3: "rgba(168, 85, 247, 0.18)",
  };
}

export function resolveAmbientPalette(
  presetId: string | undefined,
  date: Date = new Date()
): AmbientPalette {
  const preset =
    CANVAS_AMBIENT_PRESETS.find((p) => p.id === presetId) ?? CANVAS_AMBIENT_PRESETS[0];
  if (preset.adaptive) return ambientHorizonPalette(date.getHours());
  return preset;
}

export function loadCanvasBackground(): CanvasBackground {
  try {
    const raw = localStorage.getItem(CANVAS_BG_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CanvasBackground;
  } catch {
    /* ignore */
  }
  return DEFAULT_CANVAS_BACKGROUND;
}

export function saveCanvasBackground(bg: CanvasBackground) {
  localStorage.setItem(CANVAS_BG_STORAGE_KEY, JSON.stringify(bg));
}

export function canvasBackgroundCss(bg: CanvasBackground): {
  "--canvas-bg-fill": string;
  "--canvas-bg-image": string;
} {
  if (bg.kind === "default" || (!bg.value && bg.kind !== "ambient")) {
    return { "--canvas-bg-fill": "var(--bg)", "--canvas-bg-image": "none" };
  }
  if (bg.kind === "ambient") {
    const preset =
      CANVAS_AMBIENT_PRESETS.find((p) => p.id === bg.presetId) ?? CANVAS_AMBIENT_PRESETS[0];
    return { "--canvas-bg-fill": preset.base, "--canvas-bg-image": "none" };
  }
  if (bg.kind === "solid") {
    return { "--canvas-bg-fill": bg.value, "--canvas-bg-image": "none" };
  }
  if (bg.kind === "gradient") {
    return { "--canvas-bg-fill": bg.value, "--canvas-bg-image": "none" };
  }
  const image =
    bg.value.startsWith("url(") || bg.value.startsWith("data:")
      ? bg.value
      : `url("${bg.value}")`;
  return { "--canvas-bg-fill": "var(--bg)", "--canvas-bg-image": image };
}
