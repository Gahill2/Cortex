import { useCallback, useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import {
  CORTEX_HOME_HERO_STORAGE_KEY,
  defaultHomeHeroConfig,
  normalizeHomeHeroConfig,
  type HomeHeroConfig,
} from "../components/home/homeHeroConfig";

function loadFromStorage(): HomeHeroConfig {
  try {
    const raw = localStorage.getItem(CORTEX_HOME_HERO_STORAGE_KEY);
    if (!raw) return defaultHomeHeroConfig();
    return normalizeHomeHeroConfig(JSON.parse(raw) as HomeHeroConfig);
  } catch {
    return defaultHomeHeroConfig();
  }
}

export function useHomeHeroConfig(): [HomeHeroConfig, (next: HomeHeroConfig) => void] {
  const { settings, ready, patch } = usePreferences();
  const serverHero = settings.extraJson?.homeHero;

  const [config, setConfigLocal] = useState<HomeHeroConfig>(loadFromStorage);

  useEffect(() => {
    if (!ready) return;
    if (serverHero && typeof serverHero === "object") {
      const normalized = normalizeHomeHeroConfig(serverHero as HomeHeroConfig);
      setConfigLocal(normalized);
      try {
        localStorage.setItem(CORTEX_HOME_HERO_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        /* ignore */
      }
    }
  }, [ready, serverHero]);

  const setConfig = useCallback(
    (next: HomeHeroConfig) => {
      const normalized = normalizeHomeHeroConfig(next);
      setConfigLocal(normalized);
      try {
        localStorage.setItem(CORTEX_HOME_HERO_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        /* ignore */
      }
      patch({ extraJson: { homeHero: normalized } });
    },
    [patch],
  );

  return [config, setConfig];
}
