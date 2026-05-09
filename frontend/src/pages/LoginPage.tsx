import { useState } from "react";
import { api } from "../api/client";

interface Props {
  onLogin: (token: string) => void;
}

export const LoginPage = ({ onLogin }: Props) => {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/send-otp", { email: email.trim().toLowerCase() });
      setStep("otp");
    } catch {
      setError("Failed to send code. Check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/verify-otp", {
        email: email.trim().toLowerCase(),
        code: code.trim()
      });
      onLogin(res.data.token as string);
    } catch {
      setError("Invalid or expired code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-logo-wrap">
          <div className="login-logo-glyph">C</div>
          <span className="login-logo-word">CORTEX</span>
        </div>
        <p className="login-tagline">Your personal command layer</p>

        {step === "email" ? (
          <div className="login-form">
            <label className="login-label">Email address</label>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendOtp()}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
            />
            {error && <p className="login-error">{error}</p>}
            <button
              className="login-btn"
              onClick={() => void sendOtp()}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending…" : "Continue →"}
            </button>
            <p className="login-hint">We'll email you a sign-in code — no password needed</p>
          </div>
        ) : (
          <div className="login-form">
            <label className="login-label">6-digit code</label>
            <p className="login-subtext">
              Sent to <strong>{email}</strong> ·{" "}
              <button className="login-link" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
                Change
              </button>
            </p>
            <input
              className="login-input login-otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && void verifyOtp()}
              placeholder="000000"
              autoFocus
              autoComplete="one-time-code"
            />
            {error && <p className="login-error">{error}</p>}
            <button
              className="login-btn"
              onClick={() => void verifyOtp()}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button className="login-resend" onClick={() => void sendOtp()} disabled={loading}>
              Resend code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
