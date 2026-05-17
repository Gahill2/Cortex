import { useEffect, useState, useCallback } from "react";

const THEME_KEY = "cortex_ai_theme";

export interface AppTheme {
  name: string;
  gradient: string;
  accent: string;
  accentSecondary: string;
  widgetBg: string;
  description?: string;
}

function applyThemeToDOM(theme: AppTheme | null) {
  const root = document.documentElement;
  const shell = document.querySelector(".desktop-shell") as HTMLElement | null;
  const notion = root.classList.contains("cortex-notion");
  if (theme) {
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-dim", theme.accent + "26");
    root.style.setProperty("--accent-secondary", theme.accentSecondary);
    root.style.setProperty("--widget-glass-bg", theme.widgetBg);
    if (shell) {
      if (notion) {
        shell.style.background = "";
        shell.style.backgroundImage = "";
        shell.removeAttribute("data-ai-theme");
      } else {
        shell.style.background = theme.gradient;
        shell.setAttribute("data-wallpaper", "true");
        shell.setAttribute("data-ai-theme", "true");
      }
    }
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-dim");
    root.style.removeProperty("--accent-secondary");
    root.style.removeProperty("--widget-glass-bg");
    if (shell) {
      shell.style.background = "";
      shell.style.backgroundImage = "";
      shell.removeAttribute("data-ai-theme");
      // Don't remove data-wallpaper — useWallpaper manages that
    }
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme | null>(() => {
    try { return JSON.parse(localStorage.getItem(THEME_KEY) ?? "null") as AppTheme | null; }
    catch { return null; }
  });

  const applyTheme = useCallback((t: AppTheme | null) => {
    applyThemeToDOM(t);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme, applyTheme]);

  const saveTheme = (t: AppTheme | null) => {
    localStorage.setItem(THEME_KEY, JSON.stringify(t));
    setThemeState(t);
  };

  return { theme, saveTheme, applyTheme };
}
