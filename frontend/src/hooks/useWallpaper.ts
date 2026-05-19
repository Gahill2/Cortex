import { useEffect, useState, useCallback } from "react";
import { usePreferencesOptional } from "../context/PreferencesContext";
import type { WallpaperState } from "./useWallpaperTypes";

export type { WallpaperState } from "./useWallpaperTypes";
export { WALLPAPER_PRESETS } from "./useWallpaperTypes";

export function useWallpaper(notionShell?: boolean) {
  const prefs = usePreferencesOptional();
  const settings = prefs?.settings;
  const ready = prefs?.ready ?? false;
  const patch = prefs?.patch;

  const readWallpaper = useCallback((): WallpaperState => {
    if (ready && settings?.wallpaper && typeof settings.wallpaper === "object") {
      const w = settings.wallpaper as WallpaperState;
      if (w.presetId) return w;
    }
    try {
      const saved = localStorage.getItem("cortex_wallpaper");
      if (saved) return JSON.parse(saved) as WallpaperState;
    } catch {
      /* ignore */
    }
    return { presetId: "none", value: "" };
  }, [ready, settings?.wallpaper]);

  const [wallpaper, setWallpaperState] = useState<WallpaperState>(readWallpaper);

  useEffect(() => {
    if (!ready) return;
    setWallpaperState(readWallpaper());
  }, [ready, readWallpaper]);

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
      shell.style.backgroundImage = wallpaper.value.startsWith("url(") ? wallpaper.value : "none";
      shell.style.background = wallpaper.value;
      shell.setAttribute("data-wallpaper", "true");
    } else {
      shell.style.background = "";
      shell.style.backgroundImage = "";
      shell.removeAttribute("data-wallpaper");
    }
  }, [wallpaper, notionShell]);

  const setWallpaper = useCallback(
    (state: WallpaperState) => {
      setWallpaperState(state);
      patch?.({ wallpaper: state });
      try {
        localStorage.setItem("cortex_wallpaper", JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
    [patch],
  );

  return { wallpaper, setWallpaper };
}
