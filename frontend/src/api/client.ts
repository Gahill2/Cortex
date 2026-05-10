import axios from "axios";

const isElectron = typeof window !== "undefined" &&
  !!(window as { electron?: { isElectron?: boolean } }).electron?.isElectron;

const baseURL = isElectron
  ? "http://localhost:4000/api"
  : (import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD
      ? "https://cortex-production-0212.up.railway.app/api"
      : "http://localhost:4000/api"));

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
