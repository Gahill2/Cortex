import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export interface ServerSettings {
  appearance: string;
  wallpaper: Record<string, unknown> | null;
  aiTheme: Record<string, unknown> | null;
  weatherCity: string | null;
  weatherUnits: string;
  homeGoals: unknown[] | null;
  canvasLayout: Record<string, unknown> | null;
  extraJson: Record<string, unknown> | null;
  hasPinSet?: boolean;
}

const EMPTY: ServerSettings = {
  appearance: "system",
  wallpaper: null,
  aiTheme: null,
  weatherCity: null,
  weatherUnits: "metric",
  homeGoals: null,
  canvasLayout: null,
  extraJson: null,
};

let cachedSettings: ServerSettings | null = null;

export function useServerSettings() {
  const [settings, setSettings] = useState<ServerSettings>(cachedSettings ?? EMPTY);
  const [loading, setLoading] = useState(!cachedSettings);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (cachedSettings) return;
    let cancelled = false;
    api
      .get<{ data?: ServerSettings }>("/settings")
      .then((r) => {
        if (cancelled) return;
        const data = r.data?.data ?? EMPTY;
        cachedSettings = data;
        setSettings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const patch = useCallback((partial: Partial<ServerSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      cachedSettings = next;
      return next;
    });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.patch("/settings", partial).catch(() => {});
    }, 500);
  }, []);

  return { settings, loading, patch };
}
