import axios from "axios";

const isElectron = typeof window !== "undefined" &&
  !!(window as { electron?: { isElectron?: boolean } }).electron?.isElectron;

/**
 * Resolves the Cortex API base (`…/api`) for axios.
 * In dev, if you open the UI at http://&lt;tailscale-ip&gt;:5173, we use that same host for :4000
 * so the phone does not call localhost (which would hit the phone itself).
 */
export function resolveCortexApiBaseURL(): string {
  if (isElectron) return "http://localhost:4000/api";

  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv;

  if (import.meta.env.PROD) {
    return "https://cortex-production-0212.up.railway.app/api";
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      const apiPort = (import.meta.env as { VITE_API_PORT?: string }).VITE_API_PORT || "4000";
      const scheme = window.location.protocol === "https:" ? "https" : "http";
      return `${scheme}://${host}:${apiPort}/api`;
    }
  }

  return "http://localhost:4000/api";
}

const baseURL = resolveCortexApiBaseURL();

export const api = axios.create({
  baseURL
});

export const setAuthToken = (token: string | null): void => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

// Initialize auth header synchronously from localStorage so widgets don't
// fire their first requests without a token after a page reload.
const _stored = typeof localStorage !== "undefined" ? localStorage.getItem("cortex_token") : null;
if (_stored) setAuthToken(_stored);

export const enrichTask = async (title: string): Promise<string> => {
  const res = await api.post<{ data: { description: string } }>("/cortex/ai/tasks/enrich", { title });
  return res.data.data.description;
};
