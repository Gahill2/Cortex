import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useToastStore } from "../stores/toastStore";
import { IntegrationsPanel } from "../components/IntegrationsPanel";
import { MicrosoftSetupCard } from "../components/settings/MicrosoftSetupCard";
import { useAppearance, type AppearanceMode } from "../AppearanceProvider";
import { useWallpaper, WALLPAPER_PRESETS } from "../hooks/useWallpaper";
import { useTheme, type AppTheme } from "../hooks/useTheme";
import { clearCortexUiPreferences } from "../lib/cortexUiStorageKeys";
import { usePreferences } from "../context/PreferencesContext";
import { startOAuthFlow } from "../lib/oauth";
import { SettingsShell } from "../components/settings/SettingsShell";
import { UiCustomizationSettings } from "../components/settings/UiCustomizationSettings";
import { MemoryPage } from "./MemoryPage";
import { McpLinkPage } from "./McpLinkPage";
import { AuthenticatorSetupForm } from "../components/settings/AuthenticatorSetupForm";
import {
  readSettingsSection,
  writeSettingsSection,
  type SettingsSectionId,
} from "../settingsNavigation";

interface Props {
  onLogout: () => void;
  onLockSession?: () => void | Promise<void>;
}

function PinChangeForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPin !== confirmPin) {
      setMessage({ type: "error", text: "New PINs do not match" });
      return;
    }
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setMessage({ type: "error", text: "PIN must be 4-6 digits" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/settings/change-pin", { currentPin, newPin });
      setMessage({ type: "success", text: "PIN updated successfully" });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Failed to update PIN";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="settings-item-left" style={{ marginBottom: 16 }}>
        <div className="settings-item-icon">🔐</div>
        <div>
          <p className="settings-item-name">Change PIN</p>
          <p className="settings-item-desc">Update the 4-6 digit PIN used to unlock your session</p>
        </div>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="d-flex flex-column gap-2" style={{ maxWidth: 320 }}>
        <input
          type="password"
          className="form-input"
          placeholder="Current PIN"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          required
        />
        <input
          type="password"
          className="form-input"
          placeholder="New PIN"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          required
        />
        <input
          type="password"
          className="form-input"
          placeholder="Confirm new PIN"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          required
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving…" : "Update PIN"}
        </button>
        {message && (
          <p className={`settings-msg settings-msg--${message.type}`}>{message.text}</p>
        )}
      </form>
    </div>
  );
}

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

const APPEARANCE_OPTIONS: { id: AppearanceMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export const SettingsPage = ({ onLogout, onLockSession }: Props) => {
  const pushToast = useToastStore((s) => s.push);
  const [section, setSection] = useState<SettingsSectionId>(
    () => readSettingsSection() ?? "appearance"
  );
  const [resetConfirming, setResetConfirming] = useState(false);
  const onSectionChange = (id: SettingsSectionId) => {
    setSection(id);
    writeSettingsSection(id);
  };

  const { resetUiPreferences } = usePreferences();
  const { appearance, setAppearance } = useAppearance();
  const { wallpaper, setWallpaper } = useWallpaper();
  const { theme, saveTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topicInput, setTopicInput] = useState("");
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(true);

  type NotionStatus = {
    configured: boolean;
    oauth_configured: boolean;
    internal_token_configured: boolean;
    user_oauth_connected: boolean;
    connected: boolean;
  };
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [notionLoading, setNotionLoading] = useState(true);

  const [vaultPath, setVaultPath] = useState("");
  const [vaultInput, setVaultInput] = useState("");
  const [vaultSaving, setVaultSaving] = useState(false);

  type CanvaStatus = {
    apps_sdk: { app_id_configured: boolean; app_origin_configured: boolean; hmr_enabled: boolean };
    connect: {
      client_id_configured: boolean;
      client_secret_configured: boolean;
      redirect_uri_configured: boolean;
      oauth_exchange_ready: boolean;
      connected: boolean;
    };
    redirect_uri_to_register: string | null;
  };
  const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
  const [canvaUrl, setCanvaUrl] = useState<string | null>(null);
  const [canvaLoading, setCanvaLoading] = useState(true);
  const [canvaOauthBanner, setCanvaOauthBanner] = useState<string | null>(null);
  const [oauthErrorBanner, setOauthErrorBanner] = useState<string | null>(null);

  const isElectron = !!(window as ElectronWindow).electron?.isElectron;

  const loadSpotify = async () => {
    setSpotifyLoading(true);
    try {
      const r = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      setSpotifyConnected(r.data?.data?.connected ?? false);
      if (!r.data?.data?.connected) {
        const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url");
        setSpotifyUrl(u.data?.data?.url ?? null);
      } else {
        setSpotifyUrl(null);
      }
    } catch (e) { console.error("[spotify] load failed:", e); }
    finally { setSpotifyLoading(false); }
  };

  const loadNotion = async () => {
    setNotionLoading(true);
    try {
      const r = await api.get<{ data?: NotionStatus }>("/notion/status");
      const s = r.data?.data;
      setNotionStatus(s ?? null);
      if (s?.configured && s.oauth_configured && !s.user_oauth_connected) {
        const u = await api.get<{ data?: { url?: string } }>("/notion/oauth/url");
        setNotionUrl(u.data?.data?.url ?? null);
      } else {
        setNotionUrl(null);
      }
    } catch {
      setNotionStatus(null);
    } finally {
      setNotionLoading(false);
    }
  };

  const loadCanva = async () => {
    setCanvaLoading(true);
    try {
      const r = await api.get<{ data?: CanvaStatus }>("/canva/status");
      const s = r.data?.data ?? null;
      setCanvaStatus(s);
      if (s?.connect.oauth_exchange_ready && !s.connect.connected) {
        const u = await api.get<{ data?: { url?: string } }>("/canva/oauth/url");
        setCanvaUrl(u.data?.data?.url ?? null);
      } else {
        setCanvaUrl(null);
      }
    } catch {
      setCanvaStatus(null);
      setCanvaUrl(null);
    } finally {
      setCanvaLoading(false);
    }
  };

  useEffect(() => { void loadSpotify(); }, []);
  useEffect(() => { void loadNotion(); }, []);
  useEffect(() => { void loadCanva(); }, []);

  useEffect(() => {
    const target = sessionStorage.getItem("cortex_settings_scroll_to");
    if (!target) return;
    sessionStorage.removeItem("cortex_settings_scroll_to");
    if (target === "settings-integrations") {
      onSectionChange("integrations");
    }
  }, []);

  useEffect(() => {
    const err = sessionStorage.getItem("cortex_oauth_error");
    if (!err) return;
    sessionStorage.removeItem("cortex_oauth_error");
    setOauthErrorBanner(`Connection failed: ${err}`);
    onSectionChange("integrations");
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    let changed = false;
    if (p.get("canva_oauth") === "connected") {
      setCanvaOauthBanner("Canva Connect is linked. Connect API calls can use the token stored on this API server.");
      p.delete("canva_oauth");
      changed = true;
    }
    const err = p.get("canva_oauth_error");
    if (err) {
      setCanvaOauthBanner(`Canva OAuth did not complete: ${decodeURIComponent(err)}`);
      p.delete("canva_oauth_error");
      changed = true;
    }
    if (changed) {
      const qs = p.toString();
      const path = window.location.pathname;
      window.history.replaceState({}, "", `${path}${qs ? `?${qs}` : ""}${window.location.hash}`);
      void loadCanva();
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<{ data?: { path: string | null } }>("/obsidian/vault");
        const p = r.data?.data?.path ?? "";
        setVaultPath(p);
        setVaultInput(p);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Reload when Electron deep-link completes
  useEffect(() => {
    const handler = (e: Event) => {
      const provider = (e as CustomEvent<{ provider: string }>).detail?.provider;
      if (provider === "spotify" || provider === "refresh") void loadSpotify();
      if (provider === "notion") void loadNotion();
      if (provider === "canva") void loadCanva();
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, []);

  const openOAuth = (url: string | null) => {
    startOAuthFlow(url);
  };

  const disconnectSpotify = async () => {
    try { await api.post("/spotify/disconnect"); await loadSpotify(); } catch { /* ignore */ }
  };

  const disconnectNotion = async () => {
    try { await api.post("/notion/disconnect"); await loadNotion(); } catch { /* ignore */ }
  };

  const disconnectCanva = async () => {
    try {
      await api.post("/canva/disconnect");
      await loadCanva();
    } catch { /* ignore */ }
  };

  const saveVaultPath = async () => {
    setVaultSaving(true);
    try {
      await api.post("/obsidian/vault", { path: vaultInput.trim() });
      setVaultPath(vaultInput.trim());
    } catch {
      /* ignore */
    } finally {
      setVaultSaving(false);
    }
  };

  const generateTheme = async () => {
    if (!topicInput.trim()) return;
    setThemeLoading(true);
    setThemeError(null);
    try {
      const r = await api.post<{ data?: AppTheme }>("/ai/theme/generate", { topic: topicInput });
      const t = r.data?.data;
      if (t) { saveTheme(t); setTopicInput(""); }
    } catch { setThemeError("Could not generate theme"); }
    finally { setThemeLoading(false); }
  };

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isRemoteWeb =
    !isElectron &&
    host !== "" &&
    host !== "localhost" &&
    host !== "127.0.0.1";

  const canvaAppId = (import.meta.env.VITE_CANVA_APP_ID as string | undefined)?.trim() ?? "";
  const canvaAppIdConfigured = canvaAppId.length > 0;

  const canvaStatusLabel = (): { tone: "connected" | "disconnected"; text: string } => {
    if (canvaLoading) return { tone: "disconnected", text: "Checking…" };
    const c = canvaStatus?.connect;
    if (c?.connected) return { tone: "connected", text: "Connect linked" };
    if (c?.oauth_exchange_ready) return { tone: "disconnected", text: "Ready to connect" };
    if (canvaStatus?.apps_sdk.app_id_configured || canvaStatus?.apps_sdk.app_origin_configured) {
      return { tone: "disconnected", text: "Apps SDK env on API" };
    }
    if (canvaAppIdConfigured) return { tone: "connected", text: "App ID in build" };
    return { tone: "disconnected", text: "Docs only" };
  };
  const cv = canvaStatusLabel();

  const openExternalUrl = (url: string) => {
    if (isElectron) {
      void (window as ElectronWindow).electron!.openExternal!(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="page settings-page settings-page--shell">
      {import.meta.env.DEV && (
        <div className="settings-dev-banner" role="status">
          <strong>Dev</strong>
          <span className="settings-dev-line">
            <code className="settings-origin-code">
              {typeof window !== "undefined" ? window.location.origin : ""}
            </code>
            <span aria-hidden className="settings-dev-dot">·</span>
            {isElectron ? "Electron" : "Browser"}
            <span aria-hidden className="settings-dev-dot">·</span>
            hot reload
          </span>
          <span className="settings-dev-sub">
            Shell & home board follow a{" "}
            <a href="https://www.lazyweb.com/" target="_blank" rel="noreferrer" className="settings-dev-link">
              Lazyweb
            </a>
            -referenced redesign: 8px spacing scale, bento board tray, taller grid rows, sidebar + tile chrome. Green stripe only in dev.
          </span>
        </div>
      )}
      {isRemoteWeb && (
        <div className="settings-origin-banner" role="status">
          <strong>Using a different URL</strong> (for example your Tailscale address) than{" "}
          <code className="settings-origin-code">localhost</code> means this browser keeps its{" "}
          <strong>own</strong> saved login, theme, and home layout. Your account data on the server is still the same
          after you sign in with the same email. The desktop Electron app is separate from this browser tab.
        </div>
      )}
      <SettingsShell active={section} onChange={onSectionChange}>
        <div className="settings-layout">
          <div className="settings-col">

          {section === "account" && (
          <>
          <section className="settings-section settings-user-card">
            <div className="settings-user-avatar">C</div>
            <div className="settings-user-info">
              <p className="settings-user-name">Cortex User</p>
              <p className="settings-user-email">greyhill999@gmail.com</p>
            </div>
          </section>
          </>
          )}

          {section === "appearance" && (
          <>
          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <p className="settings-section-desc">
              Light, dark, or match your OS. Applies to the signed-in workspace and the sign-in screen.
            </p>
            <div className="appearance-seg" role="group" aria-label="Color scheme">
              {APPEARANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`appearance-seg__btn${appearance === opt.id ? " appearance-seg__btn--active" : ""}`}
                  onClick={() => setAppearance(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <UiCustomizationSettings />

          {/* ── AI Theme ── */}
          <section className="settings-section">
            <h2 className="settings-section-title">AI Theme</h2>
            <p className="settings-section-desc">Describe something you love — AI creates a matching wallpaper and color scheme.</p>
            <div className="ai-theme-form">
              <input
                className="form-input ai-theme-input"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder='e.g. "deep ocean", "cherry blossoms", "cyberpunk city"'
                onKeyDown={(e) => { if (e.key === "Enter") void generateTheme(); }}
              />
              <button
                className="btn-primary btn-sm"
                onClick={() => void generateTheme()}
                disabled={themeLoading || !topicInput.trim()}
              >
                {themeLoading ? "Generating…" : "✦ Generate"}
              </button>
            </div>
            {themeError && <p className="settings-error">{themeError}</p>}
            {theme && (
              <div className="ai-theme-preview" style={{ background: theme.gradient }}>
                <div className="ai-theme-preview-inner">
                  <div className="ai-theme-preview-dot" style={{ background: theme.accent }} />
                  <div className="ai-theme-preview-dot" style={{ background: theme.accentSecondary }} />
                  <p className="ai-theme-preview-name">{theme.name}</p>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => saveTheme(null)}>Remove</button>
              </div>
            )}
          </section>

          {/* ── Wallpaper ── */}
          <section className="settings-section">
            <h2 className="settings-section-title">Wallpaper</h2>
            <div className="wallpaper-grid">
              {WALLPAPER_PRESETS.filter((p) => p.id !== "custom").map((preset) => (
                <button
                  key={preset.id}
                  className={`wallpaper-swatch ${wallpaper.presetId === preset.id ? "wallpaper-swatch--active" : ""}`}
                  style={{ background: preset.value || "var(--bg)" }}
                  onClick={() => setWallpaper({ presetId: preset.id, value: preset.value })}
                  title={preset.label}
                >
                  {wallpaper.presetId === preset.id && <span className="wallpaper-check">✓</span>}
                  <span className="wallpaper-swatch-label">{preset.label}</span>
                </button>
              ))}
              {/* Custom image upload */}
              <button
                className={`wallpaper-swatch wallpaper-swatch--custom ${wallpaper.presetId === "custom" ? "wallpaper-swatch--active" : ""}`}
                style={wallpaper.presetId === "custom" ? { backgroundImage: wallpaper.value, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                {wallpaper.presetId === "custom"
                  ? <span className="wallpaper-check">✓</span>
                  : <span className="wallpaper-upload-icon">📁</span>
                }
                <span className="wallpaper-swatch-label">Custom</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setWallpaper({ presetId: "custom", value: `url("${dataUrl}")` });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            {wallpaper.presetId !== "none" && (
              <button className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setWallpaper({ presetId: "none", value: "" })}>
                Remove wallpaper
              </button>
            )}
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Data &amp; display</h2>
            <p className="settings-section-desc">
              Clears saved home canvas, widgets, appearance, wallpaper, AI theme, weather, and goals from your account and this browser.
              Does not sign you out or remove MCP / integration settings.
            </p>
            <button
              type="button"
              className={`btn-danger btn-sm${resetConfirming ? " confirm-pending" : ""}`}
              onClick={() => {
                if (!resetConfirming) {
                  setResetConfirming(true);
                  setTimeout(() => setResetConfirming(false), 3000);
                  return;
                }
                setResetConfirming(false);
                void (async () => {
                  try {
                    await resetUiPreferences();
                  } catch {
                    /* still clear local cache */
                  }
                  clearCortexUiPreferences();
                  pushToast({ title: "Preferences reset", message: "Cortex UI preferences have been reset. Reloading…", tone: "neutral" });
                  setTimeout(() => window.location.reload(), 800);
                })();
              }}
            >
              {resetConfirming ? "Confirm reset?" : "Reset Cortex UI preferences"}
            </button>
          </section>
          </>
          )}

          {section === "integrations" && (
          <>
          <IntegrationsPanel compact={false} />

          <MicrosoftSetupCard />

          <section className="settings-section" id="settings-integrations">
            <h2 className="settings-section-title">Integrations</h2>

            {oauthErrorBanner && (
              <p className="settings-oauth-error" role="alert">
                {oauthErrorBanner}
              </p>
            )}

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--spotify">♫</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p className="settings-item-name">Spotify</p>
                    {!spotifyLoading && (
                      <span className={`integration-status integration-status--${spotifyConnected ? "connected" : "disconnected"}`}>
                        ● {spotifyConnected ? "Connected" : "Disconnected"}
                      </span>
                    )}
                  </div>
                  <p className="settings-item-desc">
                    {spotifyLoading ? "Checking…" : spotifyConnected ? "Now-playing & playback controls active" : "Connect to show what's playing and control playback"}
                  </p>
                </div>
              </div>
              {!spotifyLoading && (
                spotifyConnected
                  ? <button className="btn-ghost btn-sm" onClick={() => void disconnectSpotify()}>Disconnect</button>
                  : <button className="btn-primary btn-sm" onClick={() => openOAuth(spotifyUrl)}>Connect</button>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">📓</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p className="settings-item-name">Notion</p>
                    {!notionLoading && notionStatus && (
                      <span
                        className={`integration-status integration-status--${
                          notionStatus.connected ? "connected" : "disconnected"
                        }`}
                      >
                        ● {notionStatus.connected ? "Connected" : "Disconnected"}
                      </span>
                    )}
                  </div>
                  <p className="settings-item-desc">
                    {notionLoading
                      ? "Checking…"
                      : notionStatus?.internal_token_configured && !notionStatus.user_oauth_connected
                        ? "Using server NOTION_INTERNAL_TOKEN — open Notes to browse pages shared with that integration."
                        : notionStatus?.connected
                          ? "Search and preview pages from the Notes tab."
                          : notionStatus?.configured
                            ? "Connect your workspace (OAuth) or set NOTION_INTERNAL_TOKEN on the server."
                            : "Not configured — add Notion env vars on the API server."}
                  </p>
                </div>
              </div>
              {!notionLoading && notionStatus?.oauth_configured && (
                notionStatus.user_oauth_connected ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnectNotion()}>
                    Disconnect
                  </button>
                ) : (
                  <button type="button" className="btn-primary btn-sm" onClick={() => openOAuth(notionUrl)}>
                    Connect
                  </button>
                )
              )}
            </div>

            <div className="settings-item settings-item--canva-spotlight">
              <div className="settings-item-left">
                <div className="settings-item-icon settings-item-icon--canva" aria-hidden>
                  ◆
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <p className="settings-item-name">Canva</p>
                    <span className={`integration-status integration-status--${cv.tone}`}>
                      ● {cv.text}
                    </span>
                  </div>
                  {canvaOauthBanner && (
                    <p className="settings-item-desc" style={{ marginTop: 6 }} role="status">
                      {canvaOauthBanner}
                    </p>
                  )}
                  <p className="settings-item-desc">
                    Cortex does not embed the Canva editor. Use the official Apps SDK inside a Canva app, or
                    Connect APIs from this API server after linking. See{" "}
                    <code className="settings-origin-code">docs/canva.md</code>.
                    {canvaAppIdConfigured ? " VITE_CANVA_APP_ID is set in the frontend build." : ""}
                    {canvaStatus?.redirect_uri_to_register ? (
                      <>
                        {" "}
                        Register redirect{" "}
                        <code className="settings-origin-code">{canvaStatus.redirect_uri_to_register}</code> in the
                        Connect integration (Authentication).
                      </>
                    ) : null}
                  </p>
                  <div className="d-flex flex-wrap gap-2" style={{ marginTop: 8 }}>
                    {!canvaLoading && canvaStatus?.connect.oauth_exchange_ready && (
                      canvaStatus.connect.connected ? (
                        <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnectCanva()}>
                          Disconnect Connect
                        </button>
                      ) : (
                        <button type="button" className="btn-primary btn-sm" onClick={() => openOAuth(canvaUrl)}>
                          Link Connect (OAuth)
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => openExternalUrl("https://www.canva.com/")}
                    >
                      Open Canva
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => openExternalUrl("https://www.canva.com/developers/apps")}
                    >
                      Your apps (preview)
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => openExternalUrl("https://www.canva.com/developers/")}
                    >
                      Developers
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => openExternalUrl("https://www.canva.dev/docs/apps/")}
                    >
                      Apps SDK docs
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => openExternalUrl("https://www.canva.dev/docs/connect/")}
                    >
                      Connect APIs docs
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">🗂️</div>
                <div>
                  <p className="settings-item-name">Obsidian vault</p>
                  <p className="settings-item-desc">
                    Local folder of markdown files — used in the Notes tab next to Notion.
                    {vaultPath ? ` Current: ${vaultPath}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, maxWidth: "100%" }}>
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={vaultInput}
                      onChange={(e) => setVaultInput(e.target.value)}
                      placeholder="C:\path\to\vault"
                    />
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => void saveVaultPath()}
                      disabled={vaultSaving || !vaultInput.trim()}
                    >
                      {vaultSaving ? "…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">✉️</div>
                <div>
                  <p className="settings-item-name">Mail accounts</p>
                  <p className="settings-item-desc">Add Gmail or IMAP accounts in the Mail tab</p>
                </div>
              </div>
            </div>
          </section>
          </>
          )}

          {section === "shortcuts" && (
          <section className="settings-section">
            <h2 className="settings-section-title">Keyboard Shortcuts</h2>
            {[
              { key: "Enter",       desc: "Send AI message" },
              { key: "Shift+Enter", desc: "New line in AI chat" },
              { key: "Esc",         desc: "Close modals" },
            ].map((s) => (
              <div key={s.key} className="settings-shortcut-row">
                <kbd className="settings-kbd">{s.key}</kbd>
                <span className="settings-shortcut-desc">{s.desc}</span>
              </div>
            ))}
          </section>
          )}

          {section === "account" && (
          <section className="settings-section">
            <h2 className="settings-section-title">Session</h2>
            <div className="settings-item">
              <div className="settings-item-left">
                <div className="settings-item-icon">👤</div>
                <div>
                  <p className="settings-item-name">Account</p>
                  <p className="settings-item-desc">Signed in with email or authenticator app</p>
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap justify-content-end">
                {onLockSession && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void onLockSession()}
                  >
                    Lock session
                  </button>
                )}
                <button type="button" className="btn-danger btn-sm" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            </div>
          </section>
          )}

          {section === "security" && (
          <section className="settings-section settings-section--animated">
            <h2 className="settings-section-title">Security</h2>
            <AuthenticatorSetupForm />
            <PinChangeForm />
          </section>
          )}

          {section === "memory" && <MemoryPage embedded />}
          {section === "cortex-link" && <McpLinkPage embedded />}

          <div className="settings-footer">
            <p>Cortex v1.0.0</p>
            <p>Built with love — {new Date().getFullYear()}</p>
          </div>

          </div>
        </div>
      </SettingsShell>
    </div>
  );
};
