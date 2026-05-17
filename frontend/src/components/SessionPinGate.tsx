import { useState } from "react";
import { api } from "../api/client";

type Props = {
  onUnlocked: () => void;
  /** e.g. idle vs first open */
  reason?: "sign-in" | "idle" | "manual";
};

const SUBTITLE: Record<NonNullable<Props["reason"]>, string> = {
  "sign-in": "Enter your PIN to open Cortex.",
  idle: "You were away for a while. Enter your PIN to continue.",
  manual: "Session locked. Enter your PIN to continue."
};

export function SessionPinGate({ onUnlocked, reason = "sign-in" }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/verify-pin", { pin: pin.trim() });
      setPin("");
      onUnlocked();
    } catch {
      setError("Incorrect PIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen session-pin-gate" role="dialog" aria-modal="true" aria-label="Unlock session">
      <div className="login-content">
        <div className="login-logo-wrap">
          <div className="login-logo-glyph">C</div>
          <span className="login-logo-word">CORTEX</span>
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
        </div>
      </div>
    </div>
  );
}
