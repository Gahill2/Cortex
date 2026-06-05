export interface WallpaperPreset {
  id: string;
  label: string;
  value: string;
  dark: boolean;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "none", label: "Default", value: "", dark: false },
  { id: "midnight", label: "Midnight", value: "linear-gradient(135deg, #0a0a14 0%, #12122a 40%, #0f0f24 100%)", dark: false },
  { id: "aurora", label: "Aurora", value: "linear-gradient(135deg, #0d1b2a 0%, #1b4332 40%, #081c15 100%)", dark: false },
  { id: "cosmos", label: "Cosmos", value: "linear-gradient(135deg, #020024 0%, #1a0533 50%, #00d4ff22 100%)", dark: false },
  { id: "rose", label: "Rose", value: "linear-gradient(135deg, #1a0a2e 0%, #2d1050 50%, #4a0a3e 100%)", dark: false },
  { id: "ember", label: "Ember", value: "linear-gradient(135deg, #1a0a00 0%, #3d1500 50%, #5c2a00 100%)", dark: false },
  { id: "ocean", label: "Ocean", value: "linear-gradient(135deg, #000428 0%, #004e92 100%)", dark: false },
  { id: "slate", label: "Slate", value: "linear-gradient(135deg, #1c1c2e 0%, #2a2a4a 50%, #1a1a30 100%)", dark: false },
  { id: "custom", label: "Custom", value: "", dark: false },
];

export interface WallpaperState {
  presetId: string;
  value: string;
}
