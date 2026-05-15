import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getServerIntegrationConfig } from "../api/server-config";
import { ConnectOAuthButton } from "../components/ConnectOAuthButton";

type MailAccount = {
  id: string;
  email: string;
  provider: string;
  label: string | null;
  isPrimary: boolean;
};

type MailMessage = {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  unread: boolean;
  date?: string;
};

export const MailPage = () => {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizing, setOrganizing] = useState(false);
  const [organizeMsg, setOrganizeMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async (preferredAccountId?: string | null) => {
    setLoading(true);
    setLoadError(null);

    const server = await getServerIntegrationConfig();
    setConfigured(server.gmail);

    try {
      const accRes = await api.get<{ data?: { accounts?: MailAccount[] } }>("/mail/accounts");
      const accs = accRes.data?.data?.accounts ?? [];
      setAccounts(accs);

      const accountId =
        preferredAccountId && accs.some((a) => a.id === preferredAccountId)
          ? preferredAccountId
          : accs.find((a) => a.isPrimary)?.id ?? accs[0]?.id ?? null;
      setActiveAccountId(accountId);

      if (accountId) {
        const inbox = await api.get("/mail/inbox", {
          params: { accountId, maxResults: 40 }
        });
        setMessages(inbox.data?.data?.messages ?? []);
      } else {
        setMessages([]);
      }
    } catch (err: unknown) {
      setMessages([]);
      setAccounts([]);
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (server.gmail) {
        setLoadError(
          status === 404
            ? "API is out of date — restart the backend (npm run dev:web), then refresh."
            : status === 401
              ? "Session expired — sign out and sign in again."
              : "Could not load mail accounts — is the API running on port 4000?"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mail_connected") || params.has("gmail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    void load();
  }, []);

  const organize = async () => {
    if (!activeAccountId) return;
    setOrganizing(true);
    setOrganizeMsg(null);
    try {
      const r = await api.post("/mail/organize", { accountId: activeAccountId });
      const d = r.data?.data as { archived?: number; markedRead?: number; scanned?: number };
      setOrganizeMsg(
        `Organized ${d?.scanned ?? 0} unread — archived ${d?.archived ?? 0}, marked read ${d?.markedRead ?? 0}.`
      );
      await load(activeAccountId);
    } catch {
      setOrganizeMsg("Organize failed — check API logs.");
    } finally {
      setOrganizing(false);
    }
  };

  const archive = async (id: string) => {
    if (!activeAccountId) return;
    setActionBusy(id);
    try {
      await api.post("/mail/messages/archive", { messageId: id, accountId: activeAccountId });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  const markRead = async (id: string) => {
    if (!activeAccountId) return;
    setActionBusy(id);
    try {
      await api.post("/mail/messages/mark-read", { messageId: id, accountId: activeAccountId });
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  const disconnect = async (accountId: string) => {
    await api.post(`/mail/accounts/${accountId}/disconnect`);
    await load();
  };

  const unreadCount = messages.filter((m) => m.unread).length;
  const connected = accounts.length > 0;

  return (
    <div className="page gmail-page mail-page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">
            Mail
            {unreadCount > 0 && <span className="gmail-unread-badge">{unreadCount}</span>}
          </h1>
          <p className="page-subtitle">Multiple inboxes · auto-organize with AI or rules</p>
        </div>
        <div className="page-actions">
          {connected && (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={organizing || !activeAccountId}
                onClick={() => void organize()}
              >
                {organizing ? "Organizing…" : "Auto-organize"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => void load()}>
                ↻ Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {organizeMsg && <p className="mail-organize-banner">{organizeMsg}</p>}
      {loadError && <p className="mail-organize-banner mail-organize-banner--error">{loadError}</p>}

      {loading && <p className="page-loading">Loading…</p>}

      {!loading && !configured && (
        <div className="gmail-setup-card">
          <div className="gmail-setup-icon">✉</div>
          <h2>Mail not configured</h2>
          <p>
            Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and{" "}
            <code>GOOGLE_REDIRECT_URI</code> to <code>backend/.env</code>, then restart the API.
          </p>
        </div>
      )}

      {!loading && configured && !connected && (
        <div className="gmail-setup-card">
          <div className="gmail-setup-icon">✉</div>
          <h2>Connect your first inbox</h2>
          <p>Link a Gmail account. You can add more accounts after connecting.</p>
          <div style={{ marginTop: 12 }}>
            <ConnectOAuthButton service="mail" label="Connect Gmail" className="btn-primary" />
          </div>
        </div>
      )}

      {!loading && connected && (
        <>
          <div className="mail-accounts-bar">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                className={`mail-account-chip ${activeAccountId === acc.id ? "active" : ""}`}
                onClick={() => void load(acc.id)}
              >
                {acc.label ?? acc.email}
              </button>
            ))}
            <ConnectOAuthButton service="mail" label="+ Add Gmail" className="btn-ghost btn-sm" />
          </div>

          <div className="gmail-layout">
            <div className="gmail-list">
              {messages.length === 0 && <p className="gmail-empty">Inbox is empty</p>}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`gmail-row ${msg.unread ? "unread" : ""} ${selected?.id === msg.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(msg);
                    if (msg.unread) void markRead(msg.id);
                  }}
                >
                  <div className="gmail-row-dot">{msg.unread ? "●" : "○"}</div>
                  <div className="gmail-row-body">
                    <div className="gmail-row-top">
                      <span className="gmail-row-from">{msg.from.split("<")[0].trim() || msg.from}</span>
                      {msg.date && <span className="gmail-row-date">{msg.date}</span>}
                    </div>
                    <p className="gmail-row-subject">{msg.subject || "(no subject)"}</p>
                    <p className="gmail-row-snippet">{msg.snippet}</p>
                  </div>
                  <div className="gmail-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="gmail-action-btn gmail-action-btn--archive"
                      onClick={() => void archive(msg.id)}
                      disabled={actionBusy === msg.id}
                      title="Archive"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="gmail-preview">
              {selected ? (
                <>
                  <div className="gmail-preview-header">
                    <p className="gmail-preview-subject">{selected.subject || "(no subject)"}</p>
                    <p className="gmail-preview-from">{selected.from}</p>
                    <div className="gmail-preview-actions">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => void archive(selected.id)}>
                        Archive
                      </button>
                      {activeAccountId && (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void disconnect(activeAccountId)}
                        >
                          Disconnect account
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="gmail-preview-body">
                    <p className="gmail-preview-snippet">{selected.snippet}</p>
                  </div>
                </>
              ) : (
                <div className="gmail-preview-empty">
                  <p>Select an email to preview</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
