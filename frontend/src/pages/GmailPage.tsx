import { useEffect, useState } from "react";
import { api } from "../api/client";

interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  unread: boolean;
  date?: string;
}

export const GmailPage = () => {
  const [configured, setConfigured]     = useState(false);
  const [connected, setConnected]       = useState(false);
  const [messages, setMessages]         = useState<GmailMessage[]>([]);
  const [loading, setLoading]           = useState(true);
  const [oauthUrl, setOauthUrl]         = useState<string | null>(null);
  const [actionBusy, setActionBusy]     = useState<string | null>(null);
  const [selected, setSelected]         = useState<GmailMessage | null>(null);

  useEffect(() => {
    void load();
    // Handle OAuth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.has("gmail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      void load();
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const status = await api.get<{ data?: { configured: boolean; connected: boolean } }>("/gmail/status");
      const { configured: conf = false, connected: conn = false } = status.data?.data ?? {};
      setConfigured(conf);
      setConnected(conn);

      if (conn) {
        const inbox = await api.get("/gmail/inbox", { params: { maxResults: 30 } });
        const msgs: GmailMessage[] = inbox.data?.data?.messages ?? [];
        setMessages(msgs);
      } else if (conf) {
        const urlRes = await api.get<{ data?: { url: string } }>("/gmail/oauth/url");
        setOauthUrl(urlRes.data?.data?.url ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const archive = async (id: string) => {
    setActionBusy(id);
    try {
      await api.post("/gmail/messages/archive", { messageId: id });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  const markRead = async (id: string) => {
    setActionBusy(id);
    try {
      await api.post("/gmail/messages/mark-read", { messageId: id });
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, unread: false } : m));
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  const disconnect = async () => {
    await api.post("/gmail/disconnect");
    setConnected(false);
    setMessages([]);
    await load();
  };

  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div className="page gmail-page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">
            Gmail
            {unreadCount > 0 && <span className="gmail-unread-badge">{unreadCount}</span>}
          </h1>
          <p className="page-subtitle">Read, archive, and triage Gmail without leaving Cortex.</p>
        </div>
        <div className="page-actions">
          {connected && (
            <>
              <button className="btn-ghost btn-sm" onClick={() => void load()}>↻ Refresh</button>
              <button className="btn-ghost btn-sm" onClick={() => void disconnect()}>Disconnect</button>
            </>
          )}
        </div>
      </div>

      {loading && <div className="inline-loading" role="status"><span className="inline-loading-spinner" aria-hidden="true" /><span>Loading…</span></div>}

      {!loading && !configured && (
        <div className="gmail-setup-card">
          <div className="gmail-setup-icon">✉</div>
          <h2>Gmail not configured</h2>
          <p>Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>GOOGLE_REDIRECT_URI</code> to your API environment (<code>deploy/homelab/env/api.env</code> on Docker homelab).</p>
        </div>
      )}

      {!loading && configured && !connected && (
        <div className="gmail-setup-card">
          <div className="gmail-setup-icon">✉</div>
          <h2>Connect Gmail</h2>
          <p>Sign in with Google to view and manage your inbox inside Cortex.</p>
          <a className="btn-primary" href={oauthUrl ?? "#"} style={{ marginTop: 12, width: "fit-content" }}>
            Connect Google account →
          </a>
        </div>
      )}

      {!loading && connected && (
        <div className="gmail-workbench page-workbench">
        <div className="gmail-layout">
          {/* Message list */}
          <div className="gmail-list">
            {messages.length === 0 && <p className="gmail-empty">Inbox is empty</p>}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`gmail-row ${msg.unread ? "unread" : ""} ${selected?.id === msg.id ? "selected" : ""}`}
                onClick={() => { setSelected(msg); if (msg.unread) void markRead(msg.id); }}
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
                  {msg.unread && (
                    <button
                      className="gmail-action-btn"
                      onClick={() => void markRead(msg.id)}
                      disabled={actionBusy === msg.id}
                      title="Mark read"
                    >✓</button>
                  )}
                  <button
                    className="gmail-action-btn gmail-action-btn--archive"
                    onClick={() => void archive(msg.id)}
                    disabled={actionBusy === msg.id}
                    title="Archive"
                  >→</button>
                </div>
              </div>
            ))}
          </div>

          {/* Preview pane */}
          <div className="gmail-preview">
            {selected ? (
              <>
                <div className="gmail-preview-header">
                  <p className="gmail-preview-subject">{selected.subject || "(no subject)"}</p>
                  <p className="gmail-preview-from">{selected.from}</p>
                  <div className="gmail-preview-actions">
                    <button className="btn-ghost btn-sm" onClick={() => void archive(selected.id)}>Archive</button>
                  </div>
                </div>
                <div className="gmail-preview-body">
                  <p className="gmail-preview-snippet">{selected.snippet}</p>
                  <p className="gmail-preview-note">Full email body requires additional Gmail API scopes.</p>
                </div>
              </>
            ) : (
              <div className="gmail-preview-empty">
                <p>Select an email to preview</p>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
