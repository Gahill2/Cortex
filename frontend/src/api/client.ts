import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

/** Must match `App.tsx` localStorage key so the client can attach auth before the first React effects run. */
export const AUTH_STORAGE_KEY = "cortex_token";
export const AUTH_LOGOUT_EVENT = "cortex:auth-logout";

const isElectron = typeof window !== "undefined" &&
  !!(window as { electron?: { isElectron?: boolean } }).electron?.isElectron;

const baseURL = isElectron
  ? "http://localhost:4000/api"
  : (import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD
      ? "https://cortex-production-0212.up.railway.app/api"
      : // Same-origin `/api` + Vite proxy → works on localhost and on LAN/Tailscale (http://<ip>:5173)
      "/api"));

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
};

// Hydrate Authorization before any child useEffects run (React runs child effects before parent effects).
if (typeof window !== "undefined") {
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
    if (bearer === stored) {
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

export const enrichTask = async (title: string): Promise<string> => {
  const res = await api.post<{ data: { description: string } }>("/ai/tasks/enrich", { title });
  return res.data.data.description;
};
