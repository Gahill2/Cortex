import axios, { type AxiosError } from "axios";

export const AUTH_TOKEN_KEY = "cortex_token";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") ||
  "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
  timeout: 30_000,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ error?: { message?: string } }>;
  const apiMsg = ax.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (ax.code === "ECONNABORTED") return "Request timed out.";
  if (!ax.response) {
    return `Cannot reach Cortex API at ${baseURL}. Check Wi‑Fi/Tailscale and EXPO_PUBLIC_API_URL.`;
  }
  if (ax.response.status === 429) return "Too many attempts. Wait a minute and try again.";
  return fallback;
}
