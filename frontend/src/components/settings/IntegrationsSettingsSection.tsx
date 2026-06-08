import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { IntegrationItem } from "../IntegrationsPanel";
import { startOAuthFlow } from "../../lib/oauth";
import {
  connectGoogleCalendar,
  fetchCalendarStatus,
  type CalendarConnectionStatus,
} from "../../lib/googleCalendarConnect";
import { openExternalUrl } from "../../utils/openExternalUrl";
import {
  connectLinkedIn,
  disconnectLinkedIn,
  fetchLinkedInStatus,
  type LinkedInStatus,
} from "../../lib/linkedinConnect";
import type { Tab } from "../../tab";
import {
  IntegrationOAuthEnable,
  type OAuthSetupProvider,
} from "./IntegrationOAuthEnable";

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

const isElectron = () => !!(window as ElectronWindow).electron?.isElectron;

type NotionStatus = {
  configured: boolean;
  oauth_configured: boolean;
  internal_token_configured: boolean;
  user_oauth_connected: boolean;
  connected: boolean;
};

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

type MailAccount = { id: string; provider: string; email: string; isPrimary: boolean };

type IntegrationGroup = {
  id: string;
  title: string;
  hint?: string;
  itemIds: string[];
};

const GROUPS: IntegrationGroup[] = [
  {
    id: "productivity",
    title: "Email & calendar",
    hint: "Sync inbox and calendar events into Cortex.",
    itemIds: ["google", "microsoft"],
  },
  {
    id: "media",
    title: "Media & social",
    itemIds: ["spotify", "linkedin"],
  },
  {
    id: "knowledge",
    title: "Notes & knowledge",
    itemIds: ["notion", "obsidian"],
  },
  {
    id: "cloud",
    title: "Cloud & storage",
    itemIds: ["nextcloud"],
  },
  {
    id: "ai",
    title: "AI providers",
    hint: "Configured on the API server — no account linking required.",
    itemIds: ["ollama", "anthropic", "kimi"],
  },
  {
    id: "tools",
    title: "Automation & design",
    itemIds: ["n8n", "canva", "openclaw"],
  },
];

const ICONS: Record<string, string> = {
  google: "G",
  microsoft: "✉",
  spotify: "♫",
  linkedin: "in",
  notion: "📓",
  obsidian: "🗂️",
  nextcloud: "☁",
  ollama: "🦙",
  anthropic: "✦",
  kimi: "K",
  n8n: "⚡",
  canva: "◆",
  openclaw: "🔗",
  firebase: "🔥",
};

const ICON_CLASS: Record<string, string> = {
  google: "settings-item-icon--google",
  microsoft: "settings-item-icon--outlook",
  spotify: "settings-item-icon--spotify",
  linkedin: "settings-item-icon--linkedin",
  canva: "settings-item-icon--canva",
};

function statusTone(connected: boolean, configured: boolean): "connected" | "disconnected" | "partial" {
  if (connected) return "connected";
  if (configured) return "partial";
  return "disconnected";
}

function statusLabel(connected: boolean, configured: boolean): string {
  if (connected) return "Connected";
  if (configured) return "Not connected";
  return "Not configured";
}

interface IntegrationCardProps {
  icon: string;
  iconClass?: string;
  name: string;
  tone: "connected" | "disconnected" | "partial";
  statusText: string;
  description: string;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
}

function IntegrationCard({
  icon,
  iconClass,
  name,
  tone,
  statusText,
  description,
  actions,
  extra,
}: IntegrationCardProps) {
  return (
    <div className="settings-item settings-item--integration">
      <div className="settings-item-left">
        <div className={`settings-item-icon ${iconClass ?? ""}`}>{icon}</div>
        <div className="settings-item-body">
          <div className="settings-item-head">
            <p className="settings-item-name">{name}</p>
            <span className={`integration-status integration-status--${tone}`}>● {statusText}</span>
          </div>
          <p className="settings-item-desc">{description}</p>
          {extra}
        </div>
      </div>
      {actions ? <div className="settings-item-actions">{actions}</div> : null}
    </div>
  );
}

interface Props {
  oauthErrorBanner: string | null;
  onOpenTab?: (tab: Tab) => void;
}

export function IntegrationsSettingsSection({ oauthErrorBanner, onOpenTab }: Props) {
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<CalendarConnectionStatus | null>(null);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [microsoftSetup, setMicrosoftSetup] = useState<{ configured: boolean; redirectUri: string } | null>(
    null,
  );

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null);
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
  const [canvaUrl, setCanvaUrl] = useState<string | null>(null);
  const [canvaOauthBanner, setCanvaOauthBanner] = useState<string | null>(null);

  const [vaultPath, setVaultPath] = useState("");
  const [vaultInput, setVaultInput] = useState("");
  const [vaultSaving, setVaultSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [oauthSetup, setOauthSetup] = useState<OAuthSetupProvider[]>([]);

  const canvaAppId = (import.meta.env.VITE_CANVA_APP_ID as string | undefined)?.trim() ?? "";

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const setupFor = useCallback(
    (id: string) => oauthSetup.find((p) => p.id === id) ?? null,
    [oauthSetup],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [integrationsRes, oauthSetupRes, calendar, mailRes, msSetup, spotifyRes, linkedinRes, notionRes, canvaRes, vaultRes] =
        await Promise.all([
          api.get<{ data?: { items?: IntegrationItem[] } }>("/integrations/status"),
          api
            .get<{ data?: { providers?: OAuthSetupProvider[] } }>("/integrations/oauth-setup", {
              params: { returnOrigin: window.location.origin },
            })
            .catch(() => null),
          fetchCalendarStatus(),
          api.get<{ data?: { accounts?: MailAccount[] } }>("/mail/accounts").catch(() => null),
          api.get<{ data?: { configured?: boolean; redirectUri?: string } }>("/microsoft/setup").catch(() => null),
          api.get<{ data?: { connected?: boolean } }>("/spotify/status"),
          fetchLinkedInStatus(),
          api.get<{ data?: NotionStatus }>("/notion/status"),
          api.get<{ data?: CanvaStatus }>("/canva/status"),
          api.get<{ data?: { path: string | null } }>("/obsidian/vault").catch(() => null),
        ]);

      setItems(integrationsRes.data?.data?.items ?? []);
      setOauthSetup(oauthSetupRes?.data?.data?.providers ?? []);
      setCalendarStatus(calendar);
      setMailAccounts(mailRes?.data?.data?.accounts ?? []);
      setMicrosoftSetup({
        configured: Boolean(msSetup?.data?.data?.configured),
        redirectUri: msSetup?.data?.data?.redirectUri ?? "",
      });

      setLinkedInStatus(linkedinRes);
      const spotifyOn = spotifyRes.data?.data?.connected ?? false;
      setSpotifyConnected(spotifyOn);
      if (!spotifyOn) {
        const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url").catch(() => null);
        setSpotifyUrl(u?.data?.data?.url ?? null);
      } else {
        setSpotifyUrl(null);
      }

      const notion = notionRes.data?.data ?? null;
      setNotionStatus(notion);
      if (notion?.configured && notion.oauth_configured && !notion.user_oauth_connected) {
        const u = await api.get<{ data?: { url?: string } }>("/notion/oauth/url").catch(() => null);
        setNotionUrl(u?.data?.data?.url ?? null);
      } else {
        setNotionUrl(null);
      }

      const canva = canvaRes.data?.data ?? null;
      setCanvaStatus(canva);
      if (canva?.connect.oauth_exchange_ready && !canva.connect.connected) {
        const u = await api.get<{ data?: { url?: string } }>("/canva/oauth/url").catch(() => null);
        setCanvaUrl(u?.data?.data?.url ?? null);
      } else {
        setCanvaUrl(null);
      }

      const vault = vaultRes?.data?.data?.path ?? "";
      setVaultPath(vault);
      setVaultInput(vault);
    } catch {
      setActionError("Could not load integrations. Check that the API is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    let changed = false;
    if (p.get("canva_oauth") === "connected") {
      setCanvaOauthBanner("Canva Connect is linked.");
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
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
      void loadAll();
    }
  }, [loadAll]);

  useEffect(() => {
    const handler = (e: Event) => {
      const provider = (e as CustomEvent<{ provider: string }>).detail?.provider;
      if (
        provider === "spotify" ||
        provider === "linkedin" ||
        provider === "refresh" ||
        provider === "notion" ||
        provider === "canva"
      ) {
        void loadAll();
      }
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, [loadAll]);

  const connectMicrosoft = async () => {
    setConnecting("microsoft");
    try {
      const r = await api.post<{ data?: { url: string } }>("/microsoft/connect", {
        desktop: isElectron(),
        returnOrigin: window.location.origin,
      });
      startOAuthFlow(r.data?.data?.url);
    } catch {
      setActionError("Could not start Microsoft sign-in. Check MICROSOFT_CLIENT_ID in api.env.");
    } finally {
      setConnecting(null);
    }
  };

  const connectGoogle = async () => {
    setConnecting("google");
    try {
      await connectGoogleCalendar();
    } catch {
      setActionError("Could not start Google sign-in. Enable Google in the setup form below first.");
    } finally {
      setConnecting(null);
    }
  };

  const googleItem = itemMap.get("google") ?? itemMap.get("gmail");
  const googleConnected = Boolean(googleItem?.connected);
  const googleNeedsCalendarReconnect = Boolean(calendarStatus?.needsGoogleReconnect);
  const gmailAccounts = mailAccounts.filter((a) => a.provider === "gmail");
  const msAccounts = mailAccounts.filter((a) => a.provider === "microsoft");

  const renderCard = (id: string) => {
    if (id === "obsidian") {
      return (
        <IntegrationCard
          key="obsidian"
          icon={ICONS.obsidian}
          name="Obsidian vault"
          tone="connected"
          statusText={vaultPath ? "Configured" : "Optional"}
          description="Local markdown folder for the Notes tab — works offline alongside Notion."
          extra={
            <div className="settings-integration-inline">
              <input
                className="form-input"
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="/home/you/vault"
              />
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={vaultSaving || !vaultInput.trim()}
                onClick={() => void saveVault()}
              >
                {vaultSaving ? "…" : "Save path"}
              </button>
            </div>
          }
        />
      );
    }

    const item = itemMap.get(id);
    if (!item && id !== "obsidian") return null;

    if (id === "google" || id === "gmail") {
      const item = googleItem;
      if (!item) return null;
      return (
        <IntegrationCard
          key="google"
          icon={ICONS.google}
          iconClass={ICON_CLASS.google}
          name={item.name}
          tone={googleConnected && !googleNeedsCalendarReconnect ? "connected" : item.configured ? "partial" : "disconnected"}
          statusText={
            googleConnected
              ? googleNeedsCalendarReconnect
                ? "Reconnect calendar"
                : "Connected"
              : statusLabel(false, item.configured)
          }
          description={
            item.detail ??
            "Gmail inbox and Google Calendar events appear in Mail and Calendar."
          }
          actions={
            item.configured ? (
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={connecting === "google"}
                  onClick={() => void connectGoogle()}
                >
                  {googleConnected ? "Reconnect" : "Connect Google"}
                </button>
                {onOpenTab ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenTab("mail")}>
                    Manage accounts
                  </button>
                ) : null}
              </>
            ) : null
          }
          extra={
            <>
              {!item.configured && setupFor("google") ? (
                <IntegrationOAuthEnable
                  provider={setupFor("google")!}
                  onEnabled={() => void loadAll()}
                  onConnect={() => void connectGoogle()}
                />
              ) : null}
              {gmailAccounts.length > 0 ? (
                <p className="settings-item-meta">
                  Linked: {gmailAccounts.map((a) => a.email).join(", ")}
                </p>
              ) : null}
            </>
          }
        />
      );
    }

    if (id === "microsoft") {
      const msItem = item ?? {
        id: "microsoft",
        name: "Microsoft (Outlook & Calendar)",
        configured: setupFor("microsoft")?.ready ?? microsoftSetup?.configured ?? false,
        connected: msAccounts.length > 0,
        detail: "",
      };
      if (!msItem.configured) {
        const setup = setupFor("microsoft");
        return (
          <IntegrationCard
            key="microsoft"
            icon={ICONS.microsoft}
            iconClass={ICON_CLASS.microsoft}
            name={msItem.name}
            tone="disconnected"
            statusText="Enable to connect"
            description="Outlook mail and calendar — one-time OAuth setup, then Connect."
            extra={
              setup ? (
                <IntegrationOAuthEnable
                  provider={setup}
                  onEnabled={() => void loadAll()}
                  onConnect={() => void connectMicrosoft()}
                />
              ) : null
            }
          />
        );
      }
      return (
        <IntegrationCard
          key="microsoft"
          icon={ICONS.microsoft}
          iconClass={ICON_CLASS.microsoft}
          name={msItem.name}
          tone={msAccounts.length > 0 ? "connected" : "partial"}
          statusText={msAccounts.length > 0 ? "Connected" : "Not connected"}
          description={msItem.detail || "Outlook mail and calendar sync through the same account."}
          actions={
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={connecting === "microsoft"}
                onClick={() => void connectMicrosoft()}
              >
                {msAccounts.length > 0 ? "Add account" : "Connect Outlook"}
              </button>
              {onOpenTab ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenTab("mail")}>
                  Manage in Mail
                </button>
              ) : null}
            </>
          }
          extra={
            msAccounts.length > 0 ? (
              <p className="settings-item-meta">
                Linked: {msAccounts.map((a) => a.email).join(", ")}
              </p>
            ) : null
          }
        />
      );
    }

    if (id === "linkedin") {
      const configured = linkedInStatus?.configured ?? item?.configured ?? false;
      const connected = linkedInStatus?.connected ?? item?.connected ?? false;
      const profile = linkedInStatus?.profile;
      return (
        <IntegrationCard
          key="linkedin"
          icon={ICONS.linkedin}
          iconClass={ICON_CLASS.linkedin}
          name="LinkedIn"
          tone={connected ? "connected" : configured ? "partial" : "disconnected"}
          statusText={connected ? "Connected" : statusLabel(false, configured)}
          description={
            connected
              ? "Professional profile linked — use for networking context in Cortex."
              : configured
                ? "Connect with Sign In with LinkedIn (profile and email)."
                : "Enable LinkedIn below, then Connect."
          }
          actions={
            configured ? (
              connected ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => openExternalUrl("https://www.linkedin.com/")}
                  >
                    Open LinkedIn
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void disconnectLinkedIn().then(() => loadAll())}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={connecting === "linkedin"}
                  onClick={() => {
                    setConnecting("linkedin");
                    void connectLinkedIn()
                      .catch(() => setActionError("Could not start LinkedIn sign-in."))
                      .finally(() => setConnecting(null));
                  }}
                >
                  Connect LinkedIn
                </button>
              )
            ) : null
          }
          extra={
            <>
              {!configured && setupFor("linkedin") ? (
                <IntegrationOAuthEnable
                  provider={setupFor("linkedin")!}
                  onEnabled={() => void loadAll()}
                  onConnect={() => {
                    setConnecting("linkedin");
                    void connectLinkedIn()
                      .catch(() => setActionError("Could not start LinkedIn sign-in."))
                      .finally(() => setConnecting(null));
                  }}
                />
              ) : null}
              {profile?.name || profile?.email ? (
                <p className="settings-item-meta">
                  {profile.picture ? (
                    <img
                      src={profile.picture}
                      alt=""
                      className="settings-integration-avatar"
                      width={24}
                      height={24}
                    />
                  ) : null}
                  {[profile.name, profile.email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </>
          }
        />
      );
    }

    if (id === "spotify") {
      return (
        <IntegrationCard
          key="spotify"
          icon={ICONS.spotify}
          iconClass={ICON_CLASS.spotify}
          name="Spotify"
          tone={spotifyConnected ? "connected" : item?.configured ? "partial" : "disconnected"}
          statusText={spotifyConnected ? "Connected" : statusLabel(false, Boolean(item?.configured))}
          description={
            spotifyConnected
              ? "Playback, listening stats, and AI playlists. Use Refresh permissions if scopes are missing."
              : "Connect for playback, stats, and AI-generated playlists."
          }
          actions={
            item?.configured ? (
              spotifyConnected ? (
                <>
                  <button type="button" className="btn-primary btn-sm" onClick={() => void refreshSpotify()}>
                    Refresh permissions
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnectSpotify()}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary btn-sm" onClick={() => startOAuthFlow(spotifyUrl)}>
                  Connect
                </button>
              )
            ) : null
          }
          extra={
            !item?.configured && setupFor("spotify") ? (
              <IntegrationOAuthEnable
                provider={setupFor("spotify")!}
                onEnabled={() => void loadAll()}
                onConnect={() => startOAuthFlow(spotifyUrl)}
              />
            ) : null
          }
        />
      );
    }

    if (id === "notion") {
      const ns = notionStatus;
      return (
        <IntegrationCard
          key="notion"
          icon={ICONS.notion}
          name="Notion"
          tone={ns?.connected ? "connected" : ns?.configured ? "partial" : "disconnected"}
          statusText={ns?.connected ? "Connected" : statusLabel(false, Boolean(ns?.configured))}
          description={
            ns?.internal_token_configured && !ns?.user_oauth_connected
              ? "Using server NOTION_INTERNAL_TOKEN — browse pages shared with that integration in Notes."
              : ns?.connected
                ? "Search and preview workspace pages from Notes."
                : ns?.configured
                  ? "Connect your workspace (OAuth) or set NOTION_INTERNAL_TOKEN on the server."
                  : "Add Notion env vars on the API server."
          }
          actions={
            ns?.oauth_configured ? (
              ns.user_oauth_connected ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnectNotion()}>
                  Disconnect
                </button>
              ) : (
                <button type="button" className="btn-primary btn-sm" onClick={() => startOAuthFlow(notionUrl)}>
                  Connect
                </button>
              )
            ) : undefined
          }
          extra={
            !ns?.oauth_configured && setupFor("notion") ? (
              <IntegrationOAuthEnable
                provider={setupFor("notion")!}
                onEnabled={() => void loadAll()}
                onConnect={() => startOAuthFlow(notionUrl)}
              />
            ) : null
          }
        />
      );
    }

    if (id === "canva") {
      const cv = canvaStatusLabel();
      return (
        <IntegrationCard
          key="canva"
          icon={ICONS.canva}
          iconClass={ICON_CLASS.canva}
          name="Canva"
          tone={cv.tone}
          statusText={cv.text}
          description="Design via Canva Apps SDK or Connect APIs. Cortex does not embed the editor."
          extra={
            <>
              {canvaOauthBanner ? <p className="settings-item-meta">{canvaOauthBanner}</p> : null}
              {canvaStatus?.redirect_uri_to_register ? (
                <p className="settings-item-meta">
                  Register redirect{" "}
                  <code className="settings-origin-code">{canvaStatus.redirect_uri_to_register}</code>
                </p>
              ) : null}
              <div className="settings-item-actions settings-item-actions--inline">
                {canvaStatus?.connect.oauth_exchange_ready ? (
                  canvaStatus.connect.connected ? (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => void disconnectCanva()}>
                      Disconnect Connect
                    </button>
                  ) : (
                    <button type="button" className="btn-primary btn-sm" onClick={() => startOAuthFlow(canvaUrl)}>
                      Link Connect (OAuth)
                    </button>
                  )
                ) : null}
                <button type="button" className="btn-ghost btn-sm" onClick={() => openExternalUrl("https://www.canva.dev/docs/connect/")}>
                  Connect docs
                </button>
              </div>
            </>
          }
        />
      );
    }

    if (!item) return null;

    const tone = statusTone(item.connected, item.configured);
    const isServerOnly = ["ollama", "anthropic", "kimi", "n8n", "openclaw", "firebase", "nextcloud"].includes(id);

    return (
      <IntegrationCard
        key={id}
        icon={ICONS[id] ?? "•"}
        name={item.name}
        tone={tone}
        statusText={item.connected ? "Ready" : statusLabel(item.connected, item.configured)}
        description={item.detail ?? (item.configured ? "Configured on server" : "Not configured on server")}
        actions={
          id === "nextcloud" && item.configured && onOpenTab ? (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenTab("cloud")}>
              Open Cloud
            </button>
          ) : isServerOnly && !item.configured ? (
            <span className="settings-item-hint">Set env on API server</span>
          ) : undefined
        }
      />
    );
  };

  const saveVault = async () => {
    setVaultSaving(true);
    try {
      await api.post("/obsidian/vault", { path: vaultInput.trim() });
      setVaultPath(vaultInput.trim());
    } catch {
      setActionError("Could not save Obsidian vault path.");
    } finally {
      setVaultSaving(false);
    }
  };

  const refreshSpotify = async () => {
    try {
      const u = await api.get<{ data?: { url?: string } }>("/spotify/oauth/url?reconnect=1");
      startOAuthFlow(u.data?.data?.url ?? null);
    } catch {
      setActionError("Could not start Spotify reconnect.");
    }
  };

  const disconnectSpotify = async () => {
    try {
      await api.post("/spotify/disconnect");
      await loadAll();
    } catch {
      /* ignore */
    }
  };

  const disconnectNotion = async () => {
    try {
      await api.post("/notion/disconnect");
      await loadAll();
    } catch {
      /* ignore */
    }
  };

  const disconnectCanva = async () => {
    try {
      await api.post("/canva/disconnect");
      await loadAll();
    } catch {
      /* ignore */
    }
  };

  const canvaStatusLabel = (): { tone: "connected" | "disconnected" | "partial"; text: string } => {
    const c = canvaStatus?.connect;
    if (c?.connected) return { tone: "connected", text: "Connect linked" };
    if (c?.oauth_exchange_ready) return { tone: "partial", text: "Ready to connect" };
    if (canvaStatus?.apps_sdk.app_id_configured || canvaAppId) {
      return { tone: "partial", text: "Apps SDK configured" };
    }
    return { tone: "disconnected", text: "Docs only" };
  };

  const overviewItems = items.filter((i) =>
    ["google", "gmail", "microsoft", "spotify", "linkedin", "notion", "nextcloud", "ollama"].includes(i.id),
  );

  return (
    <section className="settings-section settings-section--integrations" id="settings-integrations">
      <div className="settings-integrations-header">
        <div>
          <h2 className="settings-section-title">Integrations</h2>
          <p className="settings-section-lead">
            Click <strong>Connect</strong> for any enabled service. First time only: paste OAuth keys from each
            provider (redirect URLs are automatic — no editing server files).
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void loadAll()} disabled={loading}>
          Refresh
        </button>
      </div>

      {(oauthErrorBanner || actionError) && (
        <p className="settings-oauth-error" role="alert">
          {oauthErrorBanner ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="settings-integrations-loading">Loading integrations…</p>
      ) : (
        <>
          {overviewItems.length > 0 ? (
            <div className="integrations-overview" aria-label="Integration overview">
              {overviewItems.map((item) => (
                <div
                  key={item.id}
                  className={`integration-chip integration-chip--${item.id} ${
                    item.connected ? "integration-chip--on" : item.configured ? "integration-chip--partial" : ""
                  }`}
                  title={item.detail}
                >
                  <span className="integration-chip-dot" />
                  <span className="integration-chip-name">{item.name}</span>
                </div>
              ))}
            </div>
          ) : null}

          {GROUPS.map((group) => {
            const cards = group.itemIds.map(renderCard).filter(Boolean);
            if (!cards.length) return null;
            return (
              <div key={group.id} className="settings-integration-group">
                <h3 className="settings-integration-group-title">{group.title}</h3>
                {group.hint ? <p className="settings-integration-group-hint">{group.hint}</p> : null}
                <div className="settings-integration-group-cards">{cards}</div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
