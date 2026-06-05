import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useToastStore } from "../stores/toastStore";

/** Must match `App.tsx` / `AuthContext` so the client can attach auth before the first React effects run. */
export const AUTH_STORAGE_KEY = "cortex_token";
export const AUTH_USER_STORAGE_KEY = "cortex_user";

const LEGACY_AUTH_TOKEN_KEY = "launchpad_token";
const LEGACY_AUTH_USER_KEY = "launchpad_user";

export const AUTH_LOGOUT_EVENT = "cortex:auth-logout";
export const AUTH_CHANGED_EVENT = "cortex:auth-changed";

/** Copy legacy Launchpad keys into Cortex keys once; remove legacy after copy. */
export function migrateLegacyAuthStorage(): void {
  if (typeof window === "undefined") return;
  try {
    if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
      const legacyToken = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
      if (legacyToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, legacyToken);
        localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
      }
    }
    if (!localStorage.getItem(AUTH_USER_STORAGE_KEY)) {
      const legacyUser = localStorage.getItem(LEGACY_AUTH_USER_KEY);
      if (legacyUser) {
        localStorage.setItem(AUTH_USER_STORAGE_KEY, legacyUser);
        localStorage.removeItem(LEGACY_AUTH_USER_KEY);
      }
    }
  } catch {
    /* private mode / SSR */
  }
}

const isElectron = typeof window !== "undefined" &&
  !!(window as { electron?: { isElectron?: boolean } }).electron?.isElectron;

/**
 * Resolves the Cortex API base (`…/api`) for axios.
 * Browser dev uses same-origin `/api`, proxied by Vite to 127.0.0.1:4000 (see vite.config.ts).
 * That works for localhost and Tailscale/LAN URLs without exposing port 4000 on the tailnet.
 */
export function resolveCortexApiBaseURL(): string {
  if (isElectron) return "http://localhost:4000/api";

  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;

  if (import.meta.env.PROD) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api`;
    }
    console.warn(
      "[cortex] Set VITE_API_BASE_URL at build time for split API/UI deploys (see frontend/.env.example)."
    );
    return "/api";
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }

  return "/api";
}

const baseURL = resolveCortexApiBaseURL();

export const api = axios.create({
  baseURL
});

export const setAuthToken = (token: string | null): void => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
    } catch {
      /* ignore */
    }
  } else {
    delete api.defaults.headers.common.Authorization;
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
};

// Hydrate Authorization before any child useEffects run.
if (typeof window !== "undefined") {
  migrateLegacyAuthStorage();
  try {
    const persisted = localStorage.getItem(AUTH_STORAGE_KEY);
    if (persisted) {
      api.defaults.headers.common.Authorization = `Bearer ${persisted}`;
    }
  } catch {
    /* private mode / SSR */
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _cortexAuthRetry?: boolean };

/** One retry: child effects can fire before `setAuthToken`; sync header from storage and replay. */
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = error.config as RetryableConfig | undefined;
    if (error.response?.status !== 401 || !cfg || cfg._cortexAuthRetry) {
      return Promise.reject(error);
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return Promise.reject(error);
    }
    if (!stored) return Promise.reject(error);
    const h = cfg.headers;
    const auth = (typeof h?.get === "function" ? h.get("Authorization") : (h as Record<string, unknown>)?.Authorization) as string | undefined;
    const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Wrong PIN / login attempt returns 401 with the same bearer — do not wipe the session.
    const url = String(cfg.url ?? "");
    const isAuthCredentialAttempt =
      url.includes("/auth/verify-pin") ||
      url.includes("/auth/login") ||
      url.includes("/auth/verify-otp");
    if (bearer === stored && !isAuthCredentialAttempt) {
      setAuthToken(null);
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
      return Promise.reject(error);
    }
    cfg._cortexAuthRetry = true;
    setAuthToken(stored);
    if (typeof h?.set === "function") {
      h.set("Authorization", `Bearer ${stored}`);
    } else if (h && typeof h === "object") {
      (h as Record<string, string>).Authorization = `Bearer ${stored}`;
    }
    return api.request(cfg);
  }
);

/** Tracks in-flight error toast IDs to prevent duplicate toasts for the same request. */
const _activeErrorToasts = new Set<string>();

type ErrorResponseBody = { message?: string; error?: string };

/**
 * Global error toast interceptor.
 * Shows API error messages as toasts for 4xx/5xx responses.
 * Skips 401 (handled by auth retry interceptor / logout flow).
 * De-duplicates toasts per request URL+status.
 */
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const status = error.response?.status;
    // Skip 401 — handled by auth flow
    if (!status || status === 401) return Promise.reject(error);
    if (status >= 400 && status < 600) {
      const url = String(error.config?.url ?? "unknown");
      const dedupeKey = `${status}:${url}`;
      if (!_activeErrorToasts.has(dedupeKey)) {
        _activeErrorToasts.add(dedupeKey);
        const body = error.response?.data as ErrorResponseBody | undefined;
        const apiMessage =
          (typeof body?.message === "string" && body.message) ||
          (typeof body?.error === "string" && body.error) ||
          null;
        useToastStore.getState().push({
          id: dedupeKey,
          title: apiMessage ?? "Something went wrong",
          tone: "error",
          dismissMs: 5000,
        });
        // Allow the same key to fire again after the toast is dismissed
        window.setTimeout(() => {
          _activeErrorToasts.delete(dedupeKey);
        }, 5000);
      }
    }
    return Promise.reject(error);
  }
);

export const enrichTask = async (title: string): Promise<string> => {
  const res = await api.post<{ data: { description: string } }>("/ai/tasks/enrich", { title });
  return res.data.data.description;
};
