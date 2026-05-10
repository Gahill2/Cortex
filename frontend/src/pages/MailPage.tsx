import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MailAccount {
  id: string;
  provider: "gmail" | "imap";
  label: string;
  email: string;
}

interface MailMessage {
  id: string;
  accountId: string;
  accountEmail: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread: boolean;
  threadId: string;
}

interface FullMessage extends MailMessage {
  to: string;
  body: string;
  mimeType?: string;
  labelIds: string[];
}

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const isElectron = () =>
  !!(window as ElectronWindow).electron?.isElectron;

const openUrl = async (url: string) => {
  const win = window as ElectronWindow;
  if (win.electron?.openExternal) {
    await win.electron.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

const fmtDate = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 24 * 7) return `${Math.round(diffH / 24)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
};

const senderName = (from: string): string => {
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return from.replace(/<[^>]+>/, "").trim() || from;
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface AddImapModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddImapModal = ({ onClose, onAdded }: AddImapModalProps) => {
  const [form, setForm] = useState({
    label: "",
    email: "",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "587",
    username: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/mail/accounts/imap", {
        ...form,
        imapPort: Number(form.imapPort),
        smtpPort: Number(form.smtpPort),
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to add account";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mail-modal-overlay" onClick={onClose}>
      <div className="mail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mail-modal-header">
          <h2 className="mail-modal-title">Add IMAP/SMTP Account</h2>
          <button className="mail-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="mail-form">
          {error && <div className="mail-form-error">{error}</div>}
          <div className="mail-form-row">
            <label>Display name</label>
            <input className="mail-input" value={form.label} onChange={set("label")} placeholder="e.g. Work Outlook" required />
          </div>
          <div className="mail-form-row">
            <label>Email</label>
            <input className="mail-input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required />
          </div>
          <div className="mail-form-2col">
            <div className="mail-form-row">
              <label>IMAP host</label>
              <input className="mail-input" value={form.imapHost} onChange={set("imapHost")} placeholder="imap.example.com" required />
            </div>
            <div className="mail-form-row">
              <label>IMAP port</label>
              <input className="mail-input" type="number" value={form.imapPort} onChange={set("imapPort")} required />
            </div>
          </div>
          <div className="mail-form-2col">
            <div className="mail-form-row">
              <label>SMTP host</label>
              <input className="mail-input" value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.example.com" required />
            </div>
            <div className="mail-form-row">
              <label>SMTP port</label>
              <input className="mail-input" type="number" value={form.smtpPort} onChange={set("smtpPort")} required />
            </div>
          </div>
          <div className="mail-form-row">
            <label>Username</label>
            <input className="mail-input" value={form.username} onChange={set("username")} placeholder="your@email.com" required />
          </div>
          <div className="mail-form-row">
            <label>Password / App Password</label>
            <input className="mail-input" type="password" value={form.password} onChange={set("password")} required />
          </div>
          <div className="mail-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Connecting…" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ComposeModalProps {
  accounts: MailAccount[];
  defaultAccountId?: string;
  replyTo?: MailMessage;
  onClose: () => void;
  onSent: () => void;
}

const ComposeModal = ({ accounts, defaultAccountId, replyTo, onClose, onSent }: ComposeModalProps) => {
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [to, setTo] = useState(replyTo?.from ?? "");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post("/mail/send", {
        accountId,
        to,
        subject,
        body,
        ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
      });
      onSent();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to send";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mail-modal-overlay" onClick={onClose}>
      <div className="mail-modal mail-modal--compose" onClick={(e) => e.stopPropagation()}>
        <div className="mail-modal-header">
          <h2 className="mail-modal-title">{replyTo ? "Reply" : "New Message"}</h2>
          <button className="mail-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={(e) => void send(e)} className="mail-form">
          {error && <div className="mail-form-error">{error}</div>}
          <div className="mail-form-row">
            <label>From</label>
            <select
              className="mail-input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.email}</option>
              ))}
            </select>
          </div>
          <div className="mail-form-row">
            <label>To</label>
            <input className="mail-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" required />
          </div>
          <div className="mail-form-row">
            <label>Subject</label>
            <input className="mail-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required />
          </div>
          <div className="mail-form-row mail-form-row--body">
            <label>Body</label>
            <textarea
              className="mail-input mail-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={10}
              required
            />
          </div>
          <div className="mail-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Discard</button>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main MailPage ─────────────────────────────────────────────────────────────

export const MailPage = () => {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const [fullMessage, setFullMessage] = useState<FullMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<MailMessage | undefined>(undefined);
  const [showImapModal, setShowImapModal] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // ── Load accounts ──────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const r = await api.get<{ data?: { accounts: MailAccount[] } }>("/mail/accounts");
      setAccounts(r.data?.data?.accounts ?? []);
    } catch { /* ignore */ }
  }, []);

  // ── Load inbox ─────────────────────────────────────────────────────────────
  const loadInbox = useCallback(async (accountId: string) => {
    setLoading(true);
    setSelectedMessage(null);
    setFullMessage(null);
    try {
      const params: Record<string, string | number> = { maxResults: 25 };
      if (accountId === "all") {
        params.unified = "true";
      } else {
        params.accountId = accountId;
      }
      const r = await api.get<{ data?: { messages: MailMessage[] } }>("/mail/inbox", { params });
      setMessages(r.data?.data?.messages ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      await loadAccounts();
      await loadInbox("all");
    })();
  }, [loadAccounts, loadInbox]);

  // ── Handle OAuth callback deep-link ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("mail_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
      void loadAccounts().then(() => loadInbox(selectedAccountId));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for oauth-connected events from Electron ───────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ provider: string }>).detail;
      if (detail?.provider === "mail") {
        void loadAccounts().then(() => loadInbox(selectedAccountId));
      }
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, [loadAccounts, loadInbox, selectedAccountId]);

  // ── Select account ─────────────────────────────────────────────────────────
  const selectAccount = (id: string) => {
    setSelectedAccountId(id);
    void loadInbox(id);
  };

  // ── Open message ───────────────────────────────────────────────────────────
  const openMessage = async (msg: MailMessage) => {
    setSelectedMessage(msg);
    setFullMessage(null);
    setMsgLoading(true);

    // Mark as read optimistically
    if (msg.unread) {
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, unread: false } : m)
      );
      try {
        await api.patch(`/mail/message/${msg.accountId}/${msg.id}`, { read: true });
      } catch { /* ignore */ }
    }

    try {
      const r = await api.get<{ data?: FullMessage }>(`/mail/message/${msg.accountId}/${msg.id}`);
      setFullMessage(r.data?.data ?? null);
    } catch {
      // If full body fetch fails, show snippet
      setFullMessage({ ...msg, to: "", body: msg.snippet, labelIds: [] });
    } finally {
      setMsgLoading(false);
    }
  };

  // ── Archive ────────────────────────────────────────────────────────────────
  const archive = async (msg: MailMessage) => {
    setActionBusy(msg.id);
    try {
      await api.patch(`/mail/message/${msg.accountId}/${msg.id}`, { archived: true });
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(null);
        setFullMessage(null);
      }
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  // ── Add Gmail account ──────────────────────────────────────────────────────
  const addGmailAccount = async () => {
    try {
      const r = await api.post<{ data?: { url: string } }>(
        "/mail/accounts/gmail/connect",
        { desktop: isElectron() }
      );
      const url = r.data?.data?.url;
      if (url) await openUrl(url);
    } catch { /* ignore */ }
  };

  // ── Remove account ─────────────────────────────────────────────────────────
  const removeAccount = async (accountId: string) => {
    if (!confirm("Remove this mail account?")) return;
    try {
      await api.delete(`/mail/accounts/${accountId}`);
      await loadAccounts();
      if (selectedAccountId === accountId) {
        selectAccount("all");
      }
    } catch { /* ignore */ }
  };

  const unreadTotal = messages.filter((m) => m.unread).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page mail-page">
      {/* Title bar */}
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">
            Mail
            {unreadTotal > 0 && <span className="gmail-unread-badge">{unreadTotal}</span>}
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn-ghost btn-sm" onClick={() => void loadInbox(selectedAccountId)}>
            ↻ Refresh
          </button>
          <button className="btn-primary btn-sm" onClick={() => { setReplyTo(undefined); setComposing(true); }}>
            + Compose
          </button>
        </div>
      </div>

      <div className="mail-layout">
        {/* ── Sidebar ── */}
        <aside className="mail-sidebar">
          <button
            className={`mail-sidebar-item ${selectedAccountId === "all" ? "active" : ""}`}
            onClick={() => selectAccount("all")}
          >
            <span className="mail-sidebar-icon">📥</span>
            <span className="mail-sidebar-label">All Mail</span>
            {unreadTotal > 0 && <span className="mail-sidebar-badge">{unreadTotal}</span>}
          </button>

          {accounts.length > 0 && <div className="mail-sidebar-divider" />}

          {accounts.map((account) => (
            <div key={account.id} className="mail-sidebar-account-row">
              <button
                className={`mail-sidebar-item mail-sidebar-item--account ${selectedAccountId === account.id ? "active" : ""}`}
                onClick={() => selectAccount(account.id)}
                title={account.email}
              >
                <span className="mail-sidebar-icon">
                  {account.provider === "gmail" ? "G" : "✉"}
                </span>
                <span className="mail-sidebar-label mail-sidebar-label--truncate">
                  {account.label}
                </span>
              </button>
              <button
                className="mail-sidebar-remove"
                onClick={() => void removeAccount(account.id)}
                title="Remove account"
              >✕</button>
            </div>
          ))}

          <div className="mail-sidebar-divider" />

          <button className="mail-sidebar-add" onClick={() => void addGmailAccount()}>
            + Add Gmail
          </button>
          <button className="mail-sidebar-add" onClick={() => setShowImapModal(true)}>
            + Add IMAP/SMTP
          </button>
        </aside>

        {/* ── Message list ── */}
        <div className="mail-list-pane">
          {loading ? (
            <p className="page-loading">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className="mail-empty-state">
              <div className="mail-empty-icon">✉</div>
              <h2>No mail accounts</h2>
              <p>Add a Gmail account or connect via IMAP/SMTP to get started.</p>
              <div className="mail-empty-actions">
                <button className="btn-primary" onClick={() => void addGmailAccount()}>
                  Connect Gmail
                </button>
                <button className="btn-ghost" onClick={() => setShowImapModal(true)}>
                  Add IMAP/SMTP
                </button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <p className="gmail-empty">No messages found</p>
          ) : (
            messages.map((msg) => (
              <div
                key={`${msg.accountId}:${msg.id}`}
                className={`gmail-row ${msg.unread ? "unread" : ""} ${selectedMessage?.id === msg.id ? "selected" : ""}`}
                onClick={() => void openMessage(msg)}
              >
                <div className="gmail-row-dot">{msg.unread ? "●" : "○"}</div>
                <div className="gmail-row-body">
                  <div className="gmail-row-top">
                    <span className="gmail-row-from">{senderName(msg.from)}</span>
                    <div className="mail-row-meta">
                      {accounts.length > 1 && selectedAccountId === "all" && (
                        <span className="mail-row-account">{msg.accountEmail.split("@")[0]}</span>
                      )}
                      {msg.date && <span className="gmail-row-date">{fmtDate(msg.date)}</span>}
                    </div>
                  </div>
                  <p className="gmail-row-subject">{msg.subject || "(no subject)"}</p>
                  <p className="gmail-row-snippet">{msg.snippet}</p>
                </div>
                <div className="gmail-row-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="gmail-action-btn gmail-action-btn--archive"
                    onClick={() => void archive(msg)}
                    disabled={actionBusy === msg.id}
                    title="Archive"
                  >→</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Preview pane ── */}
        <div className="gmail-preview">
          {selectedMessage ? (
            <>
              <div className="gmail-preview-header">
                <p className="gmail-preview-subject">{selectedMessage.subject || "(no subject)"}</p>
                <p className="gmail-preview-from">{selectedMessage.from}</p>
                {fullMessage?.to && (
                  <p className="mail-preview-to">To: {fullMessage.to}</p>
                )}
                <div className="gmail-preview-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setReplyTo(selectedMessage);
                      setComposing(true);
                    }}
                  >
                    ↩ Reply
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => void archive(selectedMessage)}
                  >
                    Archive
                  </button>
                </div>
              </div>
              <div className="gmail-preview-body mail-preview-body">
                {msgLoading ? (
                  <p className="page-loading">Loading…</p>
                ) : fullMessage?.body ? (
                  fullMessage.mimeType?.includes("html") ? (
                    <iframe
                      className="mail-preview-iframe"
                      srcDoc={fullMessage.body}
                      sandbox="allow-same-origin"
                      title="Email body"
                    />
                  ) : (
                    <pre className="mail-preview-text">{fullMessage.body}</pre>
                  )
                ) : (
                  <p className="gmail-preview-snippet">{selectedMessage.snippet}</p>
                )}
              </div>
            </>
          ) : (
            <div className="gmail-preview-empty">
              <p>Select an email to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showImapModal && (
        <AddImapModal
          onClose={() => setShowImapModal(false)}
          onAdded={() => {
            void loadAccounts();
            void loadInbox(selectedAccountId);
          }}
        />
      )}

      {composing && (
        <ComposeModal
          accounts={accounts}
          defaultAccountId={
            selectedAccountId !== "all" ? selectedAccountId : accounts[0]?.id
          }
          replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(undefined); }}
          onSent={() => void loadInbox(selectedAccountId)}
        />
      )}
    </div>
  );
};
