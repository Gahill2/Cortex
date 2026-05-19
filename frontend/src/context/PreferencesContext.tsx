import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, AUTH_LOGOUT_EVENT } from "../api/client";
import type { ServerSettings } from "../lib/preferencesTypes";
import { EMPTY_SETTINGS } from "../lib/preferencesTypes";
import {
  clearMigratedLocalPreferences,
  collectLocalPreferences,
  isServerSettingsEmpty,
  mergeSettings,
  normalizeLoadedSettings,
} from "../lib/preferencesMigrate";

type PreferencesContextValue = {
  settings: ServerSettings;
  ready: boolean;
  patch: (partial: Partial<ServerSettings>) => void;
  resetUiPreferences: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

let cachedSettings: ServerSettings | null = null;

export function clearPreferencesCache(): void {
  cachedSettings = null;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ServerSettings>(cachedSettings ?? EMPTY_SETTINGS);
  const [ready, setReady] = useState(Boolean(cachedSettings));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingPatchRef = useRef<Partial<ServerSettings>>({});

  const flushPatch = useCallback(() => {
    const body = pendingPatchRef.current;
    if (Object.keys(body).length === 0) return;
    pendingPatchRef.current = {};
    void api.patch("/settings", body).catch((err) => {
      console.warn("[preferences] save failed:", err);
    });
  }, []);

  const patch = useCallback(
    (partial: Partial<ServerSettings>) => {
      setSettings((prev) => {
        const next = mergeSettings(prev, partial);
        cachedSettings = next;
        return next;
      });

      const prev = pendingPatchRef.current;
      pendingPatchRef.current = {
        ...prev,
        ...partial,
        extraJson:
          partial.extraJson !== undefined
            ? { ...(prev.extraJson ?? {}), ...(partial.extraJson ?? {}) }
            : prev.extraJson,
        canvasLayout: partial.canvasLayout !== undefined ? partial.canvasLayout : prev.canvasLayout,
      };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushPatch, 500);
    },
    [flushPatch],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const r = await api.get<{ data?: Partial<ServerSettings> }>("/settings");
        if (cancelled) return;

        let loaded = normalizeLoadedSettings(r.data?.data);

        if (isServerSettingsEmpty(loaded)) {
          const local = collectLocalPreferences();
          if (Object.keys(local).length > 0) {
            loaded = mergeSettings(loaded, local);
            await api.patch("/settings", local);
            clearMigratedLocalPreferences();
          }
        }

        cachedSettings = loaded;
        setSettings(loaded);
      } catch (err) {
        console.warn("[preferences] load failed, using local fallback:", err);
        const local = collectLocalPreferences();
        if (Object.keys(local).length > 0) {
          const merged = mergeSettings(EMPTY_SETTINGS, local);
          cachedSettings = merged;
          setSettings(merged);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onLogout = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingPatchRef.current = {};
      clearPreferencesCache();
      setSettings(EMPTY_SETTINGS);
      setReady(false);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      flushPatch();
    };
  }, [flushPatch]);

  const resetUiPreferences = useCallback(async () => {
    const defaults: Partial<ServerSettings> = {
      appearance: "system",
      wallpaper: null,
      aiTheme: null,
      weatherCity: null,
      weatherUnits: "metric",
      homeGoals: null,
      canvasLayout: null,
      extraJson: null,
    };
    clearMigratedLocalPreferences();
    pendingPatchRef.current = {};
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await api.patch("/settings", defaults);
    cachedSettings = EMPTY_SETTINGS;
    setSettings(EMPTY_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, ready, patch, resetUiPreferences }),
    [settings, ready, patch, resetUiPreferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider (e.g. login). */
export function usePreferencesOptional(): PreferencesContextValue | null {
  return useContext(PreferencesContext);
}
