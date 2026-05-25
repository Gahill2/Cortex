import { useState } from "react";
import type { AxiosError } from "axios";
import { api, AUTH_STORAGE_KEY, setAuthToken } from "../api/client";
import { CortexBrand } from "./brand/CortexBrand";

type Props = {
  onUnlocked: () => void;
  /** Clear JWT and return to login when the stored token is invalid or expired */
  onSessionExpired?: () => void;
  /** e.g. idle vs first open */
  reason?: "sign-in" | "idle" | "manual";
};

const SUBTITLE: Record<NonNullable<Props["reason"]>, string> = {
  "sign-in": "Enter your PIN to open Cortex.",
  idle: "You were away for a while. Enter your PIN to continue.",
  manual: "Session locked. Enter your PIN to continue."
};

export function SessionPinGate({ onUnlocked, onSessionExpired, reason = "sign-in" }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        setError("Session expired. Sign in again.");
        onSessionExpired?.();
        return;
      }
      setAuthToken(stored);
      await api.post(
        "/auth/verify-pin",
        { pin: pin.trim() },
        { headers: { Authorization: `Bearer ${stored}` } }
      );
      setPin("");
      onUnlocked();
    } catch (err) {
      const ax = err as AxiosError<{ error?: { message?: string } }>;
      const apiMsg = ax.response?.data?.error?.message;
      if (ax.response?.status === 403) {
        setError(
          apiMsg ??
            "PIN unlock is disabled on this server. Clear site data for this page or sign out and sign in again with email OTP."
        );
      } else if (ax.response?.status === 401) {
        const msg = apiMsg ?? "";
        if (/invalid|expired.*token/i.test(msg)) {
          try {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          setAuthToken(null);
          onSessionExpired?.();
          setError("Session expired. Sign in again.");
        } else {
          setError(msg || "Incorrect PIN. Try again.");
        }
      } else if (!ax.response) {
        setError("Cannot reach the Cortex API. Is the backend running on port 4000?");
      } else {
        setError(apiMsg ?? "Could not verify PIN. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen session-pin-gate" role="dialog" aria-modal="true" aria-label="Unlock session">
      <div className="login-content">
        <div className="login-logo-wrap login-logo-wrap--gate">
          <CortexBrand variant="auth" />
        </div>
        <p className="login-tagline">{SUBTITLE[reason]}</p>
        <div className="login-form">
          <label className="login-label" htmlFor="session-pin-input">
            PIN (4–6 digits)
          </label>
          <input
            id="session-pin-input"
            className="login-input login-otp-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="••••"
            autoFocus
            autoComplete="one-time-code"
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" onClick={() => void submit()} disabled={loading || pin.length < 4}>
            {loading ? "Checking…" : "Unlock"}
          </button>
          {import.meta.env.DEV && (
            <p className="login-hint" style={{ marginTop: "0.75rem", opacity: 0.65, fontSize: "0.8rem" }}>
              Dev: PIN matches <code>CORTEX_DEMO_USER_PIN</code> in backend <code>.env</code> (often <code>1234</code>).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
