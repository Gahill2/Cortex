import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";

const STORAGE_KEY = "cortex_appearance";

export type AppearanceMode = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

const VALID = new Set<string>(["light", "dark", "system"]);

function readStoredAppearance(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return "system";
    const v = JSON.parse(raw) as unknown;
    if (typeof v === "string" && VALID.has(v)) return v as AppearanceMode;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveScheme(mode: AppearanceMode): ColorScheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyColorSchemeToDocument(scheme: ColorScheme) {
  const html = document.documentElement;
  html.dataset.colorScheme = scheme;
  html.style.colorScheme = scheme;
}

type AppearanceContextValue = {
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  resolvedScheme: ColorScheme;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>(readStoredAppearance);
  const [resolvedScheme, setResolvedScheme] = useState<ColorScheme>(() =>
    typeof window !== "undefined" ? resolveScheme(readStoredAppearance()) : "light"
  );

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
    } catch {
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    const resolved = resolveScheme(appearance);
    setResolvedScheme(resolved);
    applyColorSchemeToDocument(resolved);
  }, [appearance]);

  useEffect(() => {
    if (appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveScheme("system");
      setResolvedScheme(next);
      applyColorSchemeToDocument(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance]);

  const value = useMemo(
    () => ({ appearance, setAppearance, resolvedScheme }),
    [appearance, setAppearance, resolvedScheme]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
