import { WALLPAPER_PRESETS } from "../../hooks/useWallpaper";

export type CanvasBackgroundKind = "default" | "solid" | "gradient" | "image";

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
  if (bg.kind === "default" || !bg.value) {
    return { "--canvas-bg-fill": "var(--bg)", "--canvas-bg-image": "none" };
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
