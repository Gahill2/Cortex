import axios from "axios";

type ApiErrorBody = {
  ok?: boolean;
  error?: { message?: string; code?: string };
};

/** User-facing message from a failed Cortex API call. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback;

  const status = err.response?.status;
  const body = err.response?.data as ApiErrorBody | undefined;
  const serverMsg = body?.error?.message?.trim();

  if (status === 401) {
    return "Sign in to load your data.";
  }

  if (status === 500 || status === 503) {
    return (
      serverMsg && !serverMsg.toLowerCase().includes("unexpected server error")
        ? serverMsg
        : "The API could not reach PostgreSQL. Start your database (Docker: npm run server:up, or hub: npm run hub:up), then run npm run db:migrate."
    );
  }

  if (serverMsg) return serverMsg;
  if (err.message) return err.message;
  return fallback;
}
