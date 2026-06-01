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
import { api, AUTH_CHANGED_EVENT, AUTH_LOGOUT_EVENT } from "../api/client";
import type { ServerSettings } from "../lib/preferencesTypes";
import { EMPTY_SETTINGS } from "../lib/preferencesTypes";
import {
  canvasLayoutChanged,
  clearMigratedLocalPreferences,
  collectLocalPreferences,
  hydrateLocalFromServerSettings,
  isServerSettingsEmpty,
  mergeSettings,
  normalizeLoadedSettings,
} from "../lib/preferencesMigrate";
import { CORTEX_SETTINGS_SYNC_EVENT, type SettingsSyncDetail } from "../lib/settingsSyncEvents";

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
  const lastServerUpdatedAtRef = useRef<string | null>(cachedSettings?.updatedAt ?? null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const flushPatch = useCallback(() => {
    const body = pendingPatchRef.current;
    if (Object.keys(body).length === 0) return;
    pendingPatchRef.current = {};

    const toSend = { ...body };
    if (toSend.extraJson !== undefined) {
      toSend.extraJson = settingsRef.current.extraJson;
    }

    void api.patch("/settings", toSend).then((r) => {
      const updatedAt = r.data?.data?.updatedAt;
      if (typeof updatedAt === "string") {
        lastServerUpdatedAtRef.current = updatedAt;
        setSettings((prev) => {
          const next = { ...prev, updatedAt };
          cachedSettings = next;
          return next;
        });
      }
    }).catch((err) => {
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

  const applyLoadedSettings = useCallback((loaded: ServerSettings, opts?: { fromRemote?: boolean }) => {
    const prev = settingsRef.current;
    const remoteNewer =
      opts?.fromRemote &&
      loaded.updatedAt &&
      lastServerUpdatedAtRef.current &&
      loaded.updatedAt !== lastServerUpdatedAtRef.current;

    hydrateLocalFromServerSettings(loaded);
    cachedSettings = loaded;
    lastServerUpdatedAtRef.current = loaded.updatedAt ?? null;
    setSettings(loaded);
    setReady(true);

    if (remoteNewer && canvasLayoutChanged(prev, loaded)) {
      window.dispatchEvent(
        new CustomEvent<SettingsSyncDetail>(CORTEX_SETTINGS_SYNC_EVENT, {
          detail: {
            updatedAt: loaded.updatedAt ?? null,
            canvasLayoutChanged: true,
          },
        }),
      );
    }
  }, []);

  const loadFromServer = useCallback(async (opts?: { fromRemote?: boolean }) => {
    const r = await api.get<{ data?: Partial<ServerSettings> }>("/settings");
    let loaded = normalizeLoadedSettings(r.data?.data);

    if (!opts?.fromRemote && isServerSettingsEmpty(loaded)) {
      const local = collectLocalPreferences();
      if (Object.keys(local).length > 0) {
        loaded = mergeSettings(loaded, local);
        const push = await api.patch("/settings", local);
        loaded = normalizeLoadedSettings(push.data?.data ?? loaded);
        clearMigratedLocalPreferences();
      }
    }

    applyLoadedSettings(loaded, opts);
  }, [applyLoadedSettings]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await loadFromServer();
      } catch (err) {
        console.warn("[preferences] load failed, using local fallback:", err);
        const local = collectLocalPreferences();
        if (Object.keys(local).length > 0) {
          const merged = mergeSettings(EMPTY_SETTINGS, local);
          hydrateLocalFromServerSettings(merged);
          cachedSettings = merged;
          setSettings(merged);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    const onAuthChange = () => {
      clearPreferencesCache();
      lastServerUpdatedAtRef.current = null;
      setReady(false);
      void loadFromServer().catch((err) => console.warn("[preferences] reload failed:", err));
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChange);

    const refreshFromServer = () => {
      if (document.visibilityState !== "visible") return;
      void loadFromServer({ fromRemote: true }).catch((err) =>
        console.warn("[preferences] refresh failed:", err),
      );
    };
    window.addEventListener("focus", refreshFromServer);
    document.addEventListener("visibilitychange", refreshFromServer);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChange);
      window.removeEventListener("focus", refreshFromServer);
      document.removeEventListener("visibilitychange", refreshFromServer);
    };
  }, [loadFromServer]);

  useEffect(() => {
    const onLogout = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingPatchRef.current = {};
      lastServerUpdatedAtRef.current = null;
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
    const r = await api.patch("/settings", defaults);
    const loaded = normalizeLoadedSettings(r.data?.data ?? { ...EMPTY_SETTINGS, ...defaults });
    applyLoadedSettings(loaded);
  }, [applyLoadedSettings]);

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
