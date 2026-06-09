import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useToastStore } from "../stores/toastStore";
import { IntegrationsSettingsSection } from "../components/settings/IntegrationsSettingsSection";
import type { Tab } from "../tab";
import { useAppearance, type AppearanceMode } from "../AppearanceProvider";
import { useWallpaper, WALLPAPER_PRESETS } from "../hooks/useWallpaper";
import { useTheme, type AppTheme } from "../hooks/useTheme";
import { clearCortexUiPreferences } from "../lib/cortexUiStorageKeys";
import { usePreferences } from "../context/PreferencesContext";
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
import { BUILD_INFO, formatAppVersionLabel, formatAppVersionTooltip } from "../lib/buildInfo";

interface Props {
  onLogout: () => void;
  onLockSession?: () => void | Promise<void>;
  onOpenTab?: (tab: Tab) => void;
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

export const SettingsPage = ({ onLogout, onLockSession, onOpenTab }: Props) => {
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
  const [oauthErrorBanner, setOauthErrorBanner] = useState<string | null>(null);

  const isElectron = !!(window as ElectronWindow).electron?.isElectron;

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
            <IntegrationsSettingsSection oauthErrorBanner={oauthErrorBanner} onOpenTab={onOpenTab} />
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

          <div className="settings-footer" title={formatAppVersionTooltip()}>
            <p>{formatAppVersionLabel()}</p>
            <p>cache {BUILD_INFO.sw}</p>
            <p>Built with love — {new Date().getFullYear()}</p>
          </div>

          </div>
        </div>
      </SettingsShell>
    </div>
  );
};
