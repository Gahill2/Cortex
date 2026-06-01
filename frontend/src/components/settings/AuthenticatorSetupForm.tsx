import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";

export function AuthenticatorSetupForm() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get<{ enabled?: boolean }>("/auth/totp/status");
      setEnabled(Boolean(r.data?.enabled));
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startSetup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await api.post<{ qrDataUrl?: string; manualKey?: string }>("/auth/totp/setup");
      setQrDataUrl(r.data?.qrDataUrl ?? null);
      setManualKey(r.data?.manualKey ?? null);
      setConfirmCode("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Could not start setup";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async () => {
    if (confirmCode.length !== 6) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.post("/auth/totp/confirm", { code: confirmCode.trim() });
      setMessage({ type: "success", text: "Microsoft Authenticator enabled. Next sign-in uses your app code." });
      setQrDataUrl(null);
      setManualKey(null);
      setConfirmCode("");
      setEnabled(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Invalid code";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    if (disableCode.length !== 6) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.post("/auth/totp/disable", { code: disableCode.trim() });
      setMessage({ type: "success", text: "Authenticator disabled. Email codes will be used again." });
      setDisableCode("");
      setEnabled(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Invalid code";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) {
    return <p className="settings-item-desc">Checking authenticator status…</p>;
  }

  return (
    <div className="settings-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="settings-item-left" style={{ marginBottom: 16 }}>
        <div className="settings-item-icon">📱</div>
        <div>
          <p className="settings-item-name">Microsoft Authenticator</p>
          <p className="settings-item-desc">
            {enabled
              ? "Sign in with a 6-digit code from your authenticator app (no email)."
              : "Scan a QR code with Microsoft Authenticator, Google Authenticator, or any TOTP app."}
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="d-flex flex-column gap-2" style={{ maxWidth: 320 }}>
          <input
            type="text"
            className="form-input"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="Code to disable"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button type="button" className="btn-ghost btn-sm" disabled={loading || disableCode.length !== 6} onClick={() => void disable()}>
            {loading ? "Working…" : "Disable authenticator"}
          </button>
        </div>
      ) : !qrDataUrl ? (
        <button type="button" className="btn-primary btn-sm" disabled={loading} onClick={() => void startSetup()}>
          {loading ? "Preparing…" : "Set up authenticator"}
        </button>
      ) : (
        <div className="d-flex flex-column gap-3" style={{ maxWidth: 360 }}>
          <img src={qrDataUrl} alt="Scan with Microsoft Authenticator" width={220} height={220} className="totp-qr" />
          {manualKey ? (
            <p className="settings-item-desc">
              Manual key: <code className="totp-manual-key">{manualKey}</code>
            </p>
          ) : null}
          <input
            type="text"
            className="form-input login-otp-input"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6-digit code from app"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button type="button" className="btn-primary btn-sm" disabled={loading || confirmCode.length !== 6} onClick={() => void confirmSetup()}>
            {loading ? "Verifying…" : "Confirm and enable"}
          </button>
        </div>
      )}

      {message ? <p className={`settings-msg settings-msg--${message.type}`}>{message.text}</p> : null}
    </div>
  );
}
