import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AxiosError } from "axios";
import { api } from "../api/client";

type SendOtpResponse = {
  ok: boolean;
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
  onLogin: (token: string) => void;
}

export const LoginPage = ({ onLogin }: Props) => {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<"email" | "otp">("email");
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

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<SendOtpResponse>("/auth/send-otp", {
        email: email.trim().toLowerCase(),
      });
      const data = res.data;
      applySendOtpPayload(data);

      if (data.devOtpCode) {
        setStep("otp");
        return;
      }

      if (data.message?.toLowerCase().includes("could not be emailed")) {
        setError(
          "Email is not configured on the server. Check backend SMTP settings or server logs for the code."
        );
        return;
      }

      setStep("otp");
    } catch (err) {
      setError(authErrorMessage(err, "Failed to send code. Check your email and try again."));
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
    } catch (err) {
      setError(authErrorMessage(err, "Invalid or expired code. Try again."));
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
                {loading ? "Sending..." : "Continue"}
              </button>
              <p className="login-hint">We'll email you a sign-in code — no password needed</p>
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
                {loading ? "Verifying..." : "Sign in"}
              </button>
              <button className="login-resend" onClick={() => void sendOtp()} disabled={loading}>
                Resend code
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};
