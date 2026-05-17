import { useEffect, useState } from "react";

const KEY = "cortex_wallpaper";

export interface WallpaperPreset {
  id: string;
  label: string;
  value: string; // CSS background value
  dark: boolean; // true = needs light text on sidebar/widgets
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "none",    label: "Default",  value: "",                                                                    dark: false },
  { id: "midnight",label: "Midnight", value: "linear-gradient(135deg, #0a0a14 0%, #12122a 40%, #0f0f24 100%)",     dark: false },
  { id: "aurora",  label: "Aurora",   value: "linear-gradient(135deg, #0d1b2a 0%, #1b4332 40%, #081c15 100%)",     dark: false },
  { id: "cosmos",  label: "Cosmos",   value: "linear-gradient(135deg, #020024 0%, #1a0533 50%, #00d4ff22 100%)",   dark: false },
  { id: "rose",    label: "Rose",     value: "linear-gradient(135deg, #1a0a2e 0%, #2d1050 50%, #4a0a3e 100%)",     dark: false },
  { id: "ember",   label: "Ember",    value: "linear-gradient(135deg, #1a0a00 0%, #3d1500 50%, #5c2a00 100%)",     dark: false },
  { id: "ocean",   label: "Ocean",    value: "linear-gradient(135deg, #000428 0%, #004e92 100%)",                   dark: false },
  { id: "slate",   label: "Slate",    value: "linear-gradient(135deg, #1c1c2e 0%, #2a2a4a 50%, #1a1a30 100%)",     dark: false },
  { id: "custom",  label: "Custom",   value: "",                                                                    dark: false },
];

export interface WallpaperState {
  presetId: string;
  value: string; // final CSS background value (may be custom image)
}

export function useWallpaper(notionShell?: boolean) {
  const [wallpaper, setWallpaperState] = useState<WallpaperState>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return JSON.parse(saved) as WallpaperState;
    } catch { /* ignore */ }
    return { presetId: "none", value: "" };
  });

  // Apply to root CSS variable
  useEffect(() => {
    const shell = document.querySelector(".desktop-shell") as HTMLElement | null;
    if (!shell) return;
    if (notionShell || document.documentElement.classList.contains("cortex-notion")) {
      shell.style.background = "";
      shell.style.backgroundImage = "";
      shell.removeAttribute("data-wallpaper");
      return;
    }
    if (wallpaper.value) {
      shell.style.backgroundImage = wallpaper.value.startsWith("url(")
        ? wallpaper.value
        : "none";
      shell.style.background = wallpaper.value;
      shell.setAttribute("data-wallpaper", "true");
    } else {
      shell.style.background = "";
      shell.style.backgroundImage = "";
      shell.removeAttribute("data-wallpaper");
    }
  }, [wallpaper, notionShell]);

  const setWallpaper = (state: WallpaperState) => {
    setWallpaperState(state);
    localStorage.setItem(KEY, JSON.stringify(state));
  };

  return { wallpaper, setWallpaper };
}
