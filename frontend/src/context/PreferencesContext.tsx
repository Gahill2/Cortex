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

const CANVAS_PATCH_DEBOUNCE_MS = 2_000;
const DEFAULT_PATCH_DEBOUNCE_MS = 500;

let cachedSettings: ServerSettings | null = null;

export function clearPreferencesCache(): void {
  cachedSettings = null;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ServerSettings>(cachedSettings ?? EMPTY_SETTINGS);
  const [ready, setReady] = useState(Boolean(cachedSettings));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflightSaveRef = useRef<Promise<void>>(Promise.resolve());
  const pendingPatchRef = useRef<Partial<ServerSettings>>({});
  const lastServerUpdatedAtRef = useRef<string | null>(cachedSettings?.updatedAt ?? null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const applySavedSettings = useCallback((loaded: ServerSettings) => {
    lastServerUpdatedAtRef.current = loaded.updatedAt ?? null;
    setSettings((prev) => {
      const next = mergeSettings(prev, loaded);
      cachedSettings = next;
      return next;
    });
    hydrateLocalFromServerSettings(loaded);
  }, []);

  const flushPatch = useCallback((): Promise<void> => {
    const body = pendingPatchRef.current;
    if (Object.keys(body).length === 0) return Promise.resolve();
    pendingPatchRef.current = {};

    const toSend = { ...body };
    if (toSend.extraJson !== undefined) {
      toSend.extraJson = settingsRef.current.extraJson;
    }

    const req = api
      .patch("/settings", toSend)
      .then((r) => {
        applySavedSettings(normalizeLoadedSettings(r.data?.data));
      })
      .catch((err) => {
        pendingPatchRef.current = { ...pendingPatchRef.current, ...body };
        console.warn("[preferences] save failed:", err);
      });
    inflightSaveRef.current = req;
    return req;
  }, [applySavedSettings]);

  const flushGoals = useCallback(
    (homeGoals: ServerSettings["homeGoals"]): Promise<void> => {
      try {
        if (homeGoals?.length) {
          localStorage.setItem("cortex_home_goals", JSON.stringify(homeGoals));
        } else {
          localStorage.removeItem("cortex_home_goals");
        }
      } catch {
        /* quota */
      }

      const pending = pendingPatchRef.current;
      if (pending.homeGoals !== undefined) {
        const { homeGoals: _drop, ...rest } = pending;
        pendingPatchRef.current = rest;
      }

      const req = api
        .patch("/settings", { homeGoals })
        .then((r) => {
          applySavedSettings(normalizeLoadedSettings(r.data?.data));
        })
        .catch((err) => {
          pendingPatchRef.current = { ...pendingPatchRef.current, homeGoals };
          console.warn("[preferences] goals save failed:", err);
        });
      inflightSaveRef.current = req;
      return req;
    },
    [applySavedSettings],
  );

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
        homeGoals: partial.homeGoals !== undefined ? partial.homeGoals : prev.homeGoals,
      };

      if (partial.homeGoals !== undefined) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
        void flushGoals(partial.homeGoals);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const delay =
        partial.canvasLayout !== undefined ? CANVAS_PATCH_DEBOUNCE_MS : DEFAULT_PATCH_DEBOUNCE_MS;
      debounceRef.current = setTimeout(flushPatch, delay);
    },
    [flushPatch, flushGoals],
  );

  const applyLoadedSettings = useCallback((loaded: ServerSettings, opts?: { fromRemote?: boolean }) => {
    const prev = settingsRef.current;
    const pending = pendingPatchRef.current;
    const hasPending = Object.keys(pending).length > 0;

    let effective = loaded;
    if (hasPending) {
      effective = mergeSettings(loaded, prev);
      if (pending.canvasLayout !== undefined) effective.canvasLayout = prev.canvasLayout;
      if (pending.homeGoals !== undefined) effective.homeGoals = prev.homeGoals;
      if (pending.extraJson !== undefined) {
        effective.extraJson = { ...(loaded.extraJson ?? {}), ...(prev.extraJson ?? {}) };
      }
      for (const key of Object.keys(pending)) {
        if (key === "extraJson" || key === "canvasLayout" || key === "homeGoals") continue;
        const k = key as keyof ServerSettings;
        if (pending[k] !== undefined) {
          (effective as unknown as Record<string, unknown>)[k] = prev[k];
        }
      }
    }

    const remoteNewer =
      opts?.fromRemote &&
      effective.updatedAt &&
      lastServerUpdatedAtRef.current &&
      effective.updatedAt !== lastServerUpdatedAtRef.current;

    hydrateLocalFromServerSettings(effective);
    cachedSettings = effective;
    lastServerUpdatedAtRef.current = effective.updatedAt ?? null;
    setSettings(effective);
    setReady(true);

    if (remoteNewer && canvasLayoutChanged(prev, effective)) {
      window.dispatchEvent(
        new CustomEvent<SettingsSyncDetail>(CORTEX_SETTINGS_SYNC_EVENT, {
          detail: {
            updatedAt: effective.updatedAt ?? null,
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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }
      void inflightSaveRef.current
        .then(() => flushPatch())
        .then(() => loadFromServer({ fromRemote: true }))
        .catch((err) => console.warn("[preferences] refresh failed:", err));
    };
    window.addEventListener("focus", refreshFromServer);
    document.addEventListener("visibilitychange", refreshFromServer);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChange);
      window.removeEventListener("focus", refreshFromServer);
      document.removeEventListener("visibilitychange", refreshFromServer);
    };
  }, [loadFromServer, flushPatch]);

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
