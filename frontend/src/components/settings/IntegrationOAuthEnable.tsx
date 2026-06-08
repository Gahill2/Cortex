import { useState } from "react";
import { api } from "../../api/client";
import { openExternalUrl } from "../../utils/openExternalUrl";

export type OAuthSetupProvider = {
  id: string;
  name: string;
  ready: boolean;
  redirectUri: string;
  consoleUrl: string;
  consoleHint: string;
  scopesHint?: string;
};

interface Props {
  provider: OAuthSetupProvider;
  onEnabled: () => void;
  onConnect?: () => void;
}

export function IntegrationOAuthEnable({ provider, onEnabled, onConnect }: Props) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyRedirect = () => {
    void navigator.clipboard.writeText(provider.redirectUri).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const save = async (andConnect: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/integrations/oauth-apps/${provider.id}`, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        returnOrigin: window.location.origin,
      });
      setClientId("");
      setClientSecret("");
      onEnabled();
      if (andConnect && onConnect) onConnect();
    } catch {
      setError("Could not save credentials. Check Client ID and Secret.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="integration-oauth-enable">
      <p className="integration-oauth-enable__lead">
        One-time setup (~2 min). Cortex fills in the redirect URL — paste it in the provider&apos;s console,
        then paste the keys back here.
      </p>
      <ol className="integration-oauth-enable__steps">
        <li>
          <span>Copy redirect URL</span>
          <div className="integration-oauth-enable__uri-row">
            <code className="settings-origin-code">{provider.redirectUri}</code>
            <button type="button" className="btn-ghost btn-sm" onClick={copyRedirect}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </li>
        <li>
          <span>
            <button
              type="button"
              className="btn-ghost btn-sm integration-oauth-enable__console-link"
              onClick={() => openExternalUrl(provider.consoleUrl)}
            >
              Open {provider.name} developer console
            </button>
          </span>
          <p className="integration-oauth-enable__hint">{provider.consoleHint}</p>
          {provider.scopesHint ? (
            <p className="integration-oauth-enable__hint">{provider.scopesHint}</p>
          ) : null}
        </li>
        <li>
          <span>Paste credentials</span>
          <div className="integration-oauth-enable__fields">
            <input
              className="form-input"
              placeholder="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
            <input
              className="form-input"
              type="password"
              placeholder="Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
        </li>
      </ol>
      {error ? (
        <p className="integration-oauth-enable__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="integration-oauth-enable__actions">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={saving || !clientId.trim() || !clientSecret.trim()}
          onClick={() => void save(true)}
        >
          {saving ? "Saving…" : "Save & Connect"}
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={saving || !clientId.trim() || !clientSecret.trim()}
          onClick={() => void save(false)}
        >
          Save only
        </button>
      </div>
    </div>
  );
}
