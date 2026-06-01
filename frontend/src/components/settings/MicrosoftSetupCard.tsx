import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";

export function MicrosoftSetupCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [redirectUri, setRedirectUri] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<{ data?: { configured?: boolean; redirectUri?: string } }>(
          "/microsoft/setup",
        );
        const data = r.data?.data;
        setConfigured(Boolean(data?.configured));
        setRedirectUri(data?.redirectUri ?? "");
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  const copyRedirect = useCallback(() => {
    if (!redirectUri) return;
    void navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [redirectUri]);

  if (configured) {
    return (
      <div className="settings-item">
        <div className="settings-item-left">
          <div className="settings-item-icon settings-item-icon--outlook">✉</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <p className="settings-item-name">Outlook (Microsoft)</p>
              <span className="integration-status integration-status--connected">● OAuth ready</span>
            </div>
            <p className="settings-item-desc">
              Connect from Mail → Add Outlook. Calendar sync uses the same account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-item settings-item--outlook-setup">
      <div className="settings-item-left">
        <div className="settings-item-icon settings-item-icon--outlook">✉</div>
        <div>
          <p className="settings-item-name">Outlook (Microsoft)</p>
          <p className="settings-item-desc">
            Register an Azure app, then add <code>MICROSOFT_CLIENT_ID</code> and{" "}
            <code>MICROSOFT_CLIENT_SECRET</code> to <code>deploy/homelab/env/api.env</code>. See{" "}
            <code>docs/microsoft-oauth-homelab.md</code>.
          </p>
          {redirectUri ? (
            <div className="settings-outlook-uri">
              <code className="settings-origin-code">{redirectUri}</code>
              <button type="button" className="btn-ghost btn-sm" onClick={copyRedirect}>
                {copied ? "Copied" : "Copy redirect URI"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
