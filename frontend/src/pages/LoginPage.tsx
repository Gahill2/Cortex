import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AxiosError } from "axios";
import { api, AUTH_CHANGED_EVENT, AUTH_USER_STORAGE_KEY } from "../api/client";
import type { User } from "../types";

type BeginLoginResponse = {
  ok: boolean;
  method: "totp" | "email_otp";
  message?: string;
  devOtpCode?: string;
  devHint?: string;
};

function authErrorMessage(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ error?: { message?: string } }>;
  const apiMsg = ax.response?.data?.error?.message;
  if (apiMsg) return apiMsg;
  if (ax.response?.status === 429) {
    return "Too many code requests. Wait about a minute, then try again.";
  }
  if (!ax.response) {
    return "Cannot reach the Cortex API. Make sure the backend is running on port 4000, then refresh.";
  }
  return fallback;
}
import { CortexBrand } from "../components/brand/CortexBrand";
import { LoginEpicScene } from "../components/LoginEpicScene";

interface Props {
  onLogin: (token: string, user?: User) => void;
}

export const LoginPage = ({ onLogin }: Props) => {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<"email" | "otp" | "totp">("email");
  const [loginMethod, setLoginMethod] = useState<"email_otp" | "totp" | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const applySendOtpPayload = (data: { devOtpCode?: string; devHint?: string }) => {
    if (data.devOtpCode) {
      setCode(data.devOtpCode);
      setDevNotice(data.devHint ?? "Development: email not sent — use the code below.");
    } else {
      setDevNotice(null);
    }
  };

  const beginLogin = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<BeginLoginResponse>(
        "/auth/begin-login",
        { email: email.trim().toLowerCase() },
        { timeout: 25_000 }
      );
      const data = res.data;
      setLoginMethod(data.method);

      if (data.method === "totp") {
        setStep("totp");
        setCode("");
        setDevNotice(null);
        return;
      }

      applySendOtpPayload(data);

      if (data.devOtpCode) {
        setStep("otp");
        return;
      }

      if (data.message?.toLowerCase().includes("could not be emailed")) {
        setError(
          "Email is not configured on the server. Sign in once, then enable Microsoft Authenticator under Settings → Security."
        );
        return;
      }

      setStep("otp");
    } catch (err) {
      setError(authErrorMessage(err, "Could not continue sign-in. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    const endpoint = loginMethod === "totp" ? "/auth/verify-totp" : "/auth/verify-otp";
    try {
      const res = await api.post<{ token: string; user?: User }>(
        endpoint,
        { email: email.trim().toLowerCase(), code: code.trim() },
        { timeout: 25_000 }
      );
      const nextUser = res.data.user;
      if (nextUser) {
        try {
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
        } catch {
          /* private mode */
        }
      }
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      onLogin(res.data.token, nextUser);
    } catch (err) {
      setError(authErrorMessage(err, loginMethod === "totp" ? "Invalid authenticator code." : "Invalid or expired code. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen login-scene">
      <LoginEpicScene />

      <motion.div
        className="layer depth-4 login-stage"
        data-depth="4"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <motion.div
          className="login-content"
          layout
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        >
          <div className="login-logo-wrap login-logo-wrap--card">
            <CortexBrand variant="auth" />
          </div>
          <motion.p
            className="login-tagline"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35 }}
          >
            Your <strong>neural command layer</strong> — one dashboard for everything you run.
          </motion.p>

          {typeof window !== "undefined" &&
            window.location.hostname !== "localhost" &&
            window.location.hostname !== "127.0.0.1" && (
              <p className="login-hint login-hint--remote">
                This address has its own saved session. Use the same email as on your PC to see the same account data
                after you sign in.
              </p>
            )}

          {step === "email" ? (
            <div className="login-form">
              <label className="login-label">Email address</label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void beginLogin()}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
              />
              {error && <p className="login-error">{error}</p>}
              <button
                className="login-btn"
                onClick={() => void beginLogin()}
                disabled={loading || !email.trim()}
              >
                {loading ? "Sending..." : "Continue"}
              </button>
              <p className="login-hint">Email code or Microsoft Authenticator — no password needed</p>
            </div>
          ) : step === "totp" ? (
            <div className="login-form">
              <label className="login-label">Authenticator code</label>
              <p className="login-subtext">
                Open <strong>Microsoft Authenticator</strong> (or your TOTP app) for{" "}
                <strong>{email}</strong> ·{" "}
                <button
                  className="login-link"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setDevNotice(null);
                    setLoginMethod(null);
                  }}
                >
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
                onKeyDown={(e) => e.key === "Enter" && void verifyCode()}
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
              />
              {error && <p className="login-error">{error}</p>}
              <button
                className="login-btn"
                onClick={() => void verifyCode()}
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>
            </div>
          ) : (
            <div className="login-form">
              <label className="login-label">6-digit code</label>
              <p className="login-subtext">
                Sent to <strong>{email}</strong> ┬╖{" "}
                <button
                  className="login-link"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setDevNotice(null);
                  }}
                >
                  Change
                </button>
              </p>
              {devNotice && (
                <motion.div className="login-dev-banner" role="status" layout>
                  <p className="login-dev-banner-title">Local development</p>
                  <p className="login-dev-banner-text">{devNotice}</p>
                </motion.div>
              )}
              <input
                className="login-input login-otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && void verifyCode()}
                placeholder="000000"
                autoFocus
                autoComplete="one-time-code"
              />
              {error && <p className="login-error">{error}</p>}
              <button
                className="login-btn"
                onClick={() => void verifyCode()}
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>
              <button className="login-resend" onClick={() => void beginLogin()} disabled={loading}>
                Resend code
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};
