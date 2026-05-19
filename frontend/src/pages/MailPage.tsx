import { useEffect, useState, useCallback, useRef } from "react";
import {
  Archive,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Film,
  Folder,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Mail,
  MessageCircle,
  Newspaper,
  PenSquare,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Server,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import { startOAuthFlow } from "../lib/oauth";
import { useToastStore } from "../stores/toastStore";

const MAIL_ICON_SIZE = 18;
const MAIL_ICON_STROKE = 1.75;

// ── Types ─────────────────────────────────────────────────────────────────────

interface MailAccount {
  id: string;
  provider: "gmail" | "imap" | "microsoft";
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

type MailCat = "important" | "work" | "school" | "personal" | "social" | "media" | "finance" | "newsletters" | "other";

interface CategoryMap {
  [cat: string]: { messageId: string; summary: string | null }[];
}

interface CleanupSuggestion {
  messageId: string;
  accountId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  action: "delete" | "archive" | "keep";
  reason: string;
  confidence: "high" | "medium" | "low";
  applyError?: string;
}

type CleanupApplySummary = {
  deleted: number;
  archived: number;
  failed: number;
  attempted: number;
  succeeded: number;
};

function apiErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return ax.response?.data?.error?.message ?? ax.message ?? "Request failed";
}

const cleanupKey = (s: CleanupSuggestion) => `${s.accountId}:${s.messageId}`;

const CAT_ICON_MAP: Record<MailCat, LucideIcon> = {
  important: Star,
  work: Briefcase,
  school: GraduationCap,
  personal: User,
  social: MessageCircle,
  media: Film,
  finance: CreditCard,
  newsletters: Newspaper,
  other: Folder,
};

const CAT_ORDER: MailCat[] = ["important", "work", "school", "personal", "social", "media", "finance", "newsletters", "other"];

function MailCategoryIcon({ cat, className }: { cat: MailCat; className?: string }) {
  const Icon = CAT_ICON_MAP[cat];
  return <Icon size={MAIL_ICON_SIZE} strokeWidth={MAIL_ICON_STROKE} className={className} aria-hidden />;
}

function MailProviderIcon({ provider }: { provider: MailAccount["provider"] }) {
  const cls = "mail-sidebar-icon-svg";
  if (provider === "microsoft") {
    return <LayoutGrid size={MAIL_ICON_SIZE} strokeWidth={MAIL_ICON_STROKE} className={cls} aria-hidden />;
  }
  if (provider === "imap") {
    return <Server size={MAIL_ICON_SIZE} strokeWidth={MAIL_ICON_STROKE} className={cls} aria-hidden />;
  }
  return <Mail size={MAIL_ICON_SIZE} strokeWidth={MAIL_ICON_STROKE} className={cls} aria-hidden />;
}

type ElectronWindow = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

// ── Avatar helper ─────────────────────────────────────────────────────────────

function senderAvatar(from?: string): { initial: string; color: string } {
  const raw = from?.trim() || "Unknown";
  const name = raw.split("<")[0].trim() || raw;
  const initial = name[0]?.toUpperCase() ?? "?";
  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return { initial, color: colors[h] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isElectron = () => !!(window as ElectronWindow).electron?.isElectron;

const openUrl = async (url: string) => {
  const win = window as ElectronWindow;
  if (win.electron?.openExternal) await win.electron.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
};

const fmtDate = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diffH = (Date.now() - d.getTime()) / 3600000;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 168) return `${Math.round(diffH / 24)}d ago`;
    return d.toLocaleDateString();
  } catch { return dateStr; }
};

const fmtDateFull = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return dateStr; }
};

const senderName = (from?: string): string => {
  const raw = from?.trim() || "Unknown";
  const match = raw.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return raw.replace(/<[^>]+>/, "").trim() || raw;
};

// ── AddImapModal ──────────────────────────────────────────────────────────────

interface AddImapModalProps { onClose: () => void; onAdded: () => void }

const AddImapModal = ({ onClose, onAdded }: AddImapModalProps) => {
  const [form, setForm] = useState({ label:"", email:"", imapHost:"", imapPort:"993", smtpHost:"", smtpPort:"587", username:"", password:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      await api.post("/mail/accounts/imap", { ...form, imapPort: Number(form.imapPort), smtpPort: Number(form.smtpPort) });
      onAdded(); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to add account");
    } finally { setSaving(false); }
  };

  return (
    <div className="mail-modal-overlay" onClick={onClose}>
      <div className="mail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mail-modal-header">
          <h2 className="mail-modal-title">Add IMAP/SMTP Account</h2>
          <button type="button" className="mail-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="mail-form">
          {error && <div className="mail-form-error">{error}</div>}
          <div className="mail-form-row"><label>Display name</label><input className="mail-input" value={form.label} onChange={set("label")} placeholder="e.g. Work Outlook" required /></div>
          <div className="mail-form-row"><label>Email</label><input className="mail-input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required /></div>
          <div className="mail-form-2col">
            <div className="mail-form-row"><label>IMAP host</label><input className="mail-input" value={form.imapHost} onChange={set("imapHost")} placeholder="imap.example.com" required /></div>
            <div className="mail-form-row"><label>IMAP port</label><input className="mail-input" type="number" value={form.imapPort} onChange={set("imapPort")} required /></div>
          </div>
          <div className="mail-form-2col">
            <div className="mail-form-row"><label>SMTP host</label><input className="mail-input" value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.example.com" required /></div>
            <div className="mail-form-row"><label>SMTP port</label><input className="mail-input" type="number" value={form.smtpPort} onChange={set("smtpPort")} required /></div>
          </div>
          <div className="mail-form-row"><label>Username</label><input className="mail-input" value={form.username} onChange={set("username")} placeholder="your@email.com" required /></div>
          <div className="mail-form-row"><label>Password / App Password</label><input className="mail-input" type="password" value={form.password} onChange={set("password")} required /></div>
          <div className="mail-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Connecting…" : "Add Account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── ComposeModal ──────────────────────────────────────────────────────────────

interface ComposeModalProps {
  accounts: MailAccount[];
  defaultAccountId?: string;
  replyTo?: MailMessage;
  initialBody?: string;
  onClose: () => void;
  onSent: () => void;
}

const ComposeModal = ({ accounts, defaultAccountId, replyTo, initialBody, onClose, onSent }: ComposeModalProps) => {
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [to, setTo]         = useState(replyTo?.from ?? "");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : "");
  const [body, setBody]     = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setSending(true); setError(null);
    try {
      await api.post("/mail/send", { accountId, to, subject, body, ...(replyTo ? { replyToMessageId: replyTo.id } : {}) });
      onSent(); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send");
    } finally { setSending(false); }
  };

  return (
    <div className="mail-modal-overlay" onClick={onClose}>
      <div className="mail-modal mail-modal--compose" onClick={(e) => e.stopPropagation()}>
        <div className="mail-modal-header">
          <h2 className="mail-modal-title">{replyTo ? "Reply" : "New Message"}</h2>
          <button type="button" className="mail-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
          </button>
        </div>
        <form onSubmit={(e) => void send(e)} className="mail-form">
          {error && <div className="mail-form-error">{error}</div>}
          <div className="mail-form-row"><label>From</label>
            <select className="mail-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
            </select>
          </div>
          <div className="mail-form-row"><label>To</label><input className="mail-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" required /></div>
          <div className="mail-form-row"><label>Subject</label><input className="mail-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required /></div>
          <div className="mail-form-row mail-form-row--body"><label>Body</label>
            <textarea className="mail-input mail-textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" rows={10} required />
          </div>
          <div className="mail-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Discard</button>
            <button type="submit" className="btn-primary" disabled={sending}>{sending ? "Sending…" : "Send"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main MailPage ─────────────────────────────────────────────────────────────

export const MailPage = () => {
  const pushToast = useToastStore((s) => s.push);
  const autoRulesBootstrapped = useRef(false);
  const [accounts, setAccounts]             = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedFolder, setSelectedFolder] = useState<MailCat | null>(null);
  const [messages, setMessages]             = useState<MailMessage[]>([]);
  const [allMessages, setAllMessages]       = useState<MailMessage[]>([]); // full fetch for AI
  const [categoryMap, setCategoryMap]       = useState<CategoryMap>({});
  const [catCounts, setCatCounts]           = useState<Record<string, number>>({});
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const [fullMessage, setFullMessage]       = useState<FullMessage | null>(null);
  const [loading, setLoading]               = useState(true);
  const [msgLoading, setMsgLoading]         = useState(false);
  const [organizing, setOrganizing]         = useState(false);
  const [draftingReply, setDraftingReply]   = useState(false);
  const [composing, setComposing]           = useState(false);
  const [replyTo, setReplyTo]               = useState<MailMessage | undefined>(undefined);
  const [composeInitialBody, setComposeInitialBody] = useState<string | undefined>(undefined);
  const [showImapModal, setShowImapModal]   = useState(false);
  const [actionBusy, setActionBusy]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [localUnread, setLocalUnread]       = useState<Set<string>>(new Set());
  const [cleanupOpen, setCleanupOpen]       = useState(false);
  const [cleanupScanning, setCleanupScanning] = useState(false);
  const [cleanupApplying, setCleanupApplying] = useState(false);
  const [cleanupSuggestions, setCleanupSuggestions] = useState<CleanupSuggestion[]>([]);
  const [cleanupSelected, setCleanupSelected] = useState<Set<string>>(new Set());
  const [cleanupSummary, setCleanupSummary] = useState<CleanupApplySummary | null>(null);
  const [inboxLimit, setInboxLimit] = useState(100);
  const INBOX_LIMIT_MAX = 500;
  const INBOX_LIMIT_STEP = 100;

  // ── Load accounts ──────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const r = await api.get<{ data?: { accounts: MailAccount[] } }>("/mail/accounts");
      setAccounts(r.data?.data?.accounts ?? []);
    } catch { /* ignore */ }
  }, []);

  // ── Load categories ────────────────────────────────────────────────────────
  const loadCategories = useCallback(async (): Promise<number> => {
    try {
      const r = await api.get<{ data?: { counts: Record<string, number>; categories: CategoryMap } }>("/ai/mail/categories");
      const counts = r.data?.data?.counts ?? {};
      setCatCounts(counts);
      setCategoryMap(r.data?.data?.categories ?? {});
      return Object.values(counts).reduce((s, n) => s + n, 0);
    } catch {
      return -1;
    }
  }, []);

  // ── Load inbox ─────────────────────────────────────────────────────────────
  const loadInbox = useCallback(
    async (accountId: string, limit = inboxLimit): Promise<MailMessage[]> => {
      setLoading(true);
      setSelectedMessage(null);
      setFullMessage(null);
      try {
        const params: Record<string, string | number> = {
          maxResults: Math.min(limit, INBOX_LIMIT_MAX),
        };
        if (accountId === "all") params.unified = "true";
        else params.accountId = accountId;
        const r = await api.get<{ data?: { messages: MailMessage[] } }>("/mail/inbox", { params });
        const msgs = r.data?.data?.messages ?? [];
        setAllMessages(msgs);
        setMessages(msgs);
        return msgs;
      } catch {
        return [];
      } finally {
        setLoading(false);
      }
    },
    [inboxLimit]
  );

  const loadMoreInbox = useCallback(() => {
    const next = Math.min(inboxLimit + INBOX_LIMIT_STEP, INBOX_LIMIT_MAX);
    setInboxLimit(next);
    void loadInbox(selectedAccountId, next);
  }, [inboxLimit, loadInbox, selectedAccountId]);

  useEffect(() => {
    const err = sessionStorage.getItem("cortex_oauth_error");
    if (!err) return;
    sessionStorage.removeItem("cortex_oauth_error");
    pushToast({ title: "Mail connection failed", message: err, tone: "error" });
  }, [pushToast]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      await loadAccounts();
      const msgs = await loadInbox("all");
      const catTotal = await loadCategories();

      if (
        msgs.length > 0 &&
        catTotal === 0 &&
        !autoRulesBootstrapped.current
      ) {
        autoRulesBootstrapped.current = true;
        try {
          const batch = msgs.slice(0, 50).map((m) => ({
            id: m.id,
            accountId: m.accountId,
            from: m.from,
            subject: m.subject,
            snippet: m.snippet,
          }));
          await api.post("/ai/mail/organize", { messages: batch, rulesOnly: true });
          await loadCategories();
          pushToast({
            title: "Mail folders ready",
            message: "We grouped visible messages with smart rules. Use AI Organize for finer sorting.",
            tone: "neutral",
          });
        } catch {
          autoRulesBootstrapped.current = false;
        }
      }
    })();
  }, [loadAccounts, loadInbox, loadCategories, pushToast]);

  // ── OAuth events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ provider: string }>).detail;
      if (
        detail?.provider === "mail" ||
        detail?.provider === "microsoft" ||
        detail?.provider === "gmail" ||
        detail?.provider === "refresh"
      ) {
        void loadAccounts().then(() => loadInbox(selectedAccountId));
      }
    };
    window.addEventListener("oauth-connected", handler);
    return () => window.removeEventListener("oauth-connected", handler);
  }, [loadAccounts, loadInbox, selectedAccountId]);

  // ── Filter by folder ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFolder) {
      setMessages(allMessages);
      return;
    }
    const ids = new Set((categoryMap[selectedFolder] ?? []).map((c) => c.messageId));
    setMessages(allMessages.filter((m) => ids.has(m.id)));
  }, [selectedFolder, allMessages, categoryMap]);

  // ── Select account ─────────────────────────────────────────────────────────
  const selectAccount = (id: string) => {
    setSelectedAccountId(id);
    setSelectedFolder(null);
    setInboxLimit(100);
    void loadInbox(id, 100);
  };

  const selectFolder = (cat: MailCat | null) => {
    setSelectedFolder(cat);
    setSelectedMessage(null);
    setFullMessage(null);
  };

  // ── AI Organize ────────────────────────────────────────────────────────────
  const aiOrganize = async () => {
    if (allMessages.length === 0) return;
    setOrganizing(true);
    try {
      const batch = allMessages.slice(0, 50).map((m) => ({
        id: m.id,
        accountId: m.accountId,
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
      }));
      const r = await api.post<{ data?: { mode?: string } }>("/ai/mail/organize", { messages: batch, rulesOnly: false });
      await loadCategories();

      const apply = await api.post<{ data?: { archived: number; failed?: number } }>("/mail/organize/apply", {
        accountId: selectedAccountId === "all" ? undefined : selectedAccountId,
      });
      const archived = apply.data?.data?.archived ?? 0;
      const applyFailed = apply.data?.data?.failed ?? 0;
      await loadInbox(selectedAccountId);

      const mode = r.data?.data?.mode;
      const archiveNote =
        archived > 0
          ? ` Archived ${archived} newsletter/social message(s) in your real mailbox.`
          : " No messages were archived (only newsletters, social, and media folders are auto-archived).";
      const failNote =
        applyFailed > 0
          ? ` ${applyFailed} could not be moved — reconnect the account or use Gmail for personal mail.`
          : "";
      pushToast({
        title: "Inbox organized",
        message:
          (mode === "ai+rules" ? "Categories saved in Cortex." : "Sorted with smart rules.") +
          archiveNote +
          failNote,
        tone: applyFailed > 0 && archived === 0 ? "neutral" : "success",
      });
    } catch (err: unknown) {
      pushToast({ title: "Could not organize mail", message: apiErrorMessage(err), tone: "error" });
    }
    finally { setOrganizing(false); }
  };

  // ── Backlog cleanup scan ───────────────────────────────────────────────────
  const scanBacklog = async () => {
    setCleanupScanning(true);
    try {
      const r = await api.post<{
        data?: { suggestions: CleanupSuggestion[]; scanned: number; mode: string };
      }>("/mail/cleanup/scan", {
        accountId: selectedAccountId === "all" ? undefined : selectedAccountId,
        maxMessages: 500,
        query: "in:inbox",
      });
      const suggestions = (r.data?.data?.suggestions ?? []).filter((s) => s.action !== "keep");
      setCleanupSuggestions(suggestions);
      setCleanupSelected(new Set(suggestions.map(cleanupKey)));
      setCleanupSummary(null);
      setCleanupOpen(true);
      pushToast({
        title: "Backlog scan complete",
        message: `Reviewed ${r.data?.data?.scanned ?? 0} messages (${r.data?.data?.mode ?? "rules"} suggestions).`,
        tone: "neutral",
      });
    } catch (err: unknown) {
      pushToast({ title: "Scan failed", message: apiErrorMessage(err), tone: "error" });
    } finally {
      setCleanupScanning(false);
    }
  };

  const applyCleanup = async () => {
    const items = cleanupSuggestions
      .filter((s) => cleanupSelected.has(cleanupKey(s)) && s.action !== "keep")
      .map((s) => ({
        accountId: s.accountId,
        messageId: s.messageId,
        action: s.action as "delete" | "archive",
      }));
    if (items.length === 0) return;
    if (!confirm(`Apply cleanup to ${items.length} message(s) in your real mailbox? This cannot be undone for deletions.`)) {
      return;
    }
    setCleanupApplying(true);
    try {
      type ApplyPayload = {
        deleted: number;
        archived: number;
        failed: number;
        errors?: string[];
        results?: Array<{
          accountId: string;
          messageId: string;
          action: "delete" | "archive";
          ok: boolean;
          error?: string;
        }>;
      };

      const CHUNK = 100;
      let deleted = 0;
      let archived = 0;
      let failed = 0;
      const errors: string[] = [];
      const results: NonNullable<ApplyPayload["results"]> = [];

      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const r = await api.post<{ data?: ApplyPayload }>("/mail/cleanup/apply", { items: chunk });
        const payload = r.data?.data;
        deleted += payload?.deleted ?? 0;
        archived += payload?.archived ?? 0;
        failed += payload?.failed ?? 0;
        for (const e of payload?.errors ?? []) {
          if (!errors.includes(e)) errors.push(e);
        }
        results.push(...(payload?.results ?? []));
      }
      const resultByKey = new Map<string, (typeof results)[number]>(
        results.map((row) => [`${row.accountId}:${row.messageId}`, row])
      );
      const succeeded = results.filter((row) => row.ok).length;

      setCleanupSummary({
        deleted,
        archived,
        failed,
        attempted: items.length,
        succeeded,
      });

      const remaining: CleanupSuggestion[] = [];
      const failedKeys = new Set<string>();
      for (const s of cleanupSuggestions) {
        const key = cleanupKey(s);
        if (!cleanupSelected.has(key) || s.action === "keep") {
          remaining.push(s);
          continue;
        }
        const row = resultByKey.get(key);
        if (row?.ok) continue;
        const applyError = row?.error ?? errors[0];
        remaining.push({ ...s, applyError });
        failedKeys.add(key);
      }
      setCleanupSuggestions(remaining);
      setCleanupSelected(failedKeys);
      setCleanupOpen(true);
      await loadInbox(selectedAccountId);

      const errHint = errors[0] ? ` ${errors[0]}` : "";
      if (failed > 0 && succeeded === 0) {
        pushToast({
          title: "Cleanup failed",
          message: `None of ${items.length} message(s) were updated.${errHint}`,
          tone: "error",
        });
      } else {
        pushToast({
          title: failed > 0 ? "Cleanup partly applied" : "Cleanup applied",
          message:
            succeeded > 0
              ? `${succeeded} removed from inbox (${deleted} deleted, ${archived} archived).${
                  failed > 0 ? ` ${failed} still listed below.${errHint}` : ""
                }`
              : `No changes were made.${errHint}`,
          tone: failed > 0 ? "neutral" : "success",
        });
      }
    } catch (err: unknown) {
      pushToast({ title: "Cleanup failed", message: apiErrorMessage(err), tone: "error" });
    } finally {
      setCleanupApplying(false);
    }
  };

  const toggleCleanupSelect = (key: string) => {
    setCleanupSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── AI Draft Reply ─────────────────────────────────────────────────────────
  const aiDraftReply = async () => {
    if (!selectedMessage || !fullMessage) return;
    setDraftingReply(true);
    try {
      const r = await api.post<{ data?: { draft: string } }>("/ai/mail/reply", {
        from: selectedMessage.from,
        subject: selectedMessage.subject,
        body: fullMessage.body || selectedMessage.snippet,
      });
      const draft = r.data?.data?.draft ?? "";
      setReplyTo(selectedMessage);
      setComposeInitialBody(draft);
      setComposing(true);
    } catch { /* ignore */ }
    finally { setDraftingReply(false); }
  };

  // ── Open message ───────────────────────────────────────────────────────────
  const openMessage = async (msg: MailMessage) => {
    setSelectedMessage(msg);
    setFullMessage(null);
    setMsgLoading(true);
    if (msg.unread) {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, unread: false } : m));
      try { await api.patch(`/mail/message/${msg.accountId}/${msg.id}`, { read: true }); } catch { /* ignore */ }
    }
    try {
      const r = await api.get<{ data?: FullMessage }>(`/mail/message/${msg.accountId}/${msg.id}`);
      setFullMessage(r.data?.data ?? null);
    } catch {
      setFullMessage({ ...msg, to: "", body: msg.snippet, labelIds: [] });
    } finally { setMsgLoading(false); }
  };

  // ── Archive ────────────────────────────────────────────────────────────────
  const archive = async (msg: MailMessage) => {
    setActionBusy(msg.id);
    try {
      await api.patch(`/mail/message/${msg.accountId}/${msg.id}`, { archived: true });
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setAllMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (selectedMessage?.id === msg.id) { setSelectedMessage(null); setFullMessage(null); }
    } catch { /* ignore */ }
    finally { setActionBusy(null); }
  };

  // ── Account add/remove ─────────────────────────────────────────────────────
  const addGmailAccount = async () => {
    try {
      const r = await api.post<{ data?: { url: string } }>("/mail/accounts/gmail/connect", {
        desktop: isElectron(),
        returnOrigin: window.location.origin
      });
      if (r.data?.data?.url) startOAuthFlow(r.data.data.url);
      else pushToast({ title: "Gmail connect failed", message: "No authorization URL returned.", tone: "error" });
    } catch (err: unknown) {
      pushToast({ title: "Gmail connect failed", message: apiErrorMessage(err), tone: "error" });
    }
  };

  const addOutlookAccount = async () => {
    try {
      const r = await api.post<{ data?: { url: string } }>("/microsoft/connect", {
        desktop: isElectron(),
        returnOrigin: window.location.origin
      });
      if (r.data?.data?.url) startOAuthFlow(r.data.data.url);
      else pushToast({ title: "Outlook connect failed", message: "No authorization URL returned.", tone: "error" });
    } catch (err: unknown) {
      pushToast({ title: "Outlook connect failed", message: apiErrorMessage(err), tone: "error" });
    }
  };

  const removeAccount = async (accountId: string) => {
    if (!confirm("Remove this mail account?")) return;
    try {
      await api.delete(`/mail/accounts/${accountId}`);
      await loadAccounts();
      if (selectedAccountId === accountId) selectAccount("all");
    } catch { /* ignore */ }
  };

  // ── Category for a message ─────────────────────────────────────────────────
  const msgCategory = (msgId: string): MailCat | null => {
    for (const [cat, items] of Object.entries(categoryMap)) {
      if (items.some((i) => i.messageId === msgId)) return cat as MailCat;
    }
    return null;
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          (m.subject ?? "").toLowerCase().includes(q) ||
          (m.from ?? "").toLowerCase().includes(q) ||
          (m.snippet ?? "").toLowerCase().includes(q)
        );
      })
    : messages;

  const isUnread = (msg: MailMessage) => localUnread.has(msg.id) ? true : localUnread.has(`read:${msg.id}`) ? false : msg.unread;
  const unreadTotal = messages.filter((m) => isUnread(m)).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page mail-page">
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">
            Mail {unreadTotal > 0 && <span className="gmail-unread-badge">{unreadTotal}</span>}
          </h1>
        </div>
        <div className="page-actions">
          <button
            className="btn-ghost btn-sm mail-toolbar-btn"
            onClick={() => void scanBacklog()}
            disabled={cleanupScanning || accounts.length === 0}
            title="Scan inbox, review suggestions, then Apply to change your real mailbox"
          >
            <Trash2 size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            {cleanupScanning ? "Scanning…" : "Scan backlog"}
          </button>
          <button
            className="btn-ghost btn-sm mail-toolbar-btn"
            onClick={() => void aiOrganize()}
            disabled={organizing || allMessages.length === 0}
            title="Classify in Cortex and archive newsletters in Gmail/Outlook"
          >
            <Sparkles size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            {organizing ? "Organizing…" : "AI Organize"}
          </button>
          <button type="button" className="btn-ghost btn-sm mail-toolbar-btn" onClick={() => void loadInbox(selectedAccountId)}>
            <RefreshCw size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            className="btn-primary btn-sm mail-toolbar-btn"
            onClick={() => { setReplyTo(undefined); setComposeInitialBody(undefined); setComposing(true); }}
          >
            <PenSquare size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            Compose
          </button>
        </div>
      </div>

      {cleanupOpen && (cleanupSuggestions.length > 0 || cleanupSummary) && (
        <section className="mail-cleanup-panel" aria-label="Backlog cleanup suggestions">
          {cleanupSummary && (
            <div
              className={`mail-cleanup-summary${cleanupSummary.failed > 0 ? " mail-cleanup-summary--warn" : " mail-cleanup-summary--ok"}`}
              role="status"
            >
              {cleanupSummary.succeeded > 0 ? (
                <p>
                  <strong>{cleanupSummary.succeeded}</strong> of {cleanupSummary.attempted} removed from your mailbox
                  ({cleanupSummary.deleted} deleted, {cleanupSummary.archived} archived).
                </p>
              ) : (
                <p>No messages were updated in your mailbox.</p>
              )}
              {cleanupSummary.failed > 0 && (
                <p className="mail-cleanup-summary-fail">
                  {cleanupSummary.failed} could not be applied
                  {cleanupSuggestions.length > 0 ? " — fix or retry the items below." : "."}
                </p>
              )}
            </div>
          )}
          <div className="mail-cleanup-header">
            <div>
              <h2 className="mail-cleanup-title">
                {cleanupSuggestions.length > 0 ? "Suggested cleanup" : "Cleanup complete"}
              </h2>
              <p className="mail-cleanup-sub">
                {cleanupSuggestions.length > 0
                  ? "Scan only lists suggestions — click Apply to delete or archive in Gmail/Outlook."
                  : "All selected messages were processed. Scan again for more suggestions."}
              </p>
            </div>
            <div className="mail-cleanup-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setCleanupOpen(false);
                  setCleanupSummary(null);
                }}
              >
                Dismiss
              </button>
              {cleanupSuggestions.length > 0 && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={cleanupApplying || cleanupSelected.size === 0}
                  onClick={() => void applyCleanup()}
                >
                  {cleanupApplying ? "Applying…" : `Apply (${cleanupSelected.size})`}
                </button>
              )}
            </div>
          </div>
          {cleanupSuggestions.length > 0 && (
            <ul className="mail-cleanup-list">
            {cleanupSuggestions.map((s) => {
              const key = cleanupKey(s);
              return (
                <li
                  key={key}
                  className={`mail-cleanup-item${s.applyError ? " mail-cleanup-item--failed" : ""}`}
                >
                  <label className="mail-cleanup-row">
                    <input
                      type="checkbox"
                      checked={cleanupSelected.has(key)}
                      onChange={() => toggleCleanupSelect(key)}
                    />
                    <span className="mail-cleanup-meta">
                      <span className="mail-cleanup-subject">{s.subject || "(no subject)"}</span>
                      <span className="mail-cleanup-from">{s.from}</span>
                      <span className="mail-cleanup-reason">
                        {s.action === "delete" ? "Delete" : "Archive"} — {s.reason}
                      </span>
                      {s.applyError && (
                        <span className="mail-cleanup-apply-error" role="alert">
                          Failed: {s.applyError}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          )}
        </section>
      )}

      <div className="mail-layout">
        {/* ── Sidebar ── */}
        <aside className="mail-sidebar">
          <button className={`mail-sidebar-item ${!selectedFolder && selectedAccountId === "all" ? "active" : ""}`} onClick={() => { setSelectedAccountId("all"); selectFolder(null); void loadInbox("all"); }}>
            <span className="mail-sidebar-icon" aria-hidden>
              <Inbox size={MAIL_ICON_SIZE} strokeWidth={MAIL_ICON_STROKE} className="mail-sidebar-icon-svg" />
            </span>
            <span className="mail-sidebar-label">All Mail</span>
            {unreadTotal > 0 && <span className="mail-sidebar-badge">{unreadTotal}</span>}
          </button>

          {/* AI Category folders */}
          <>
            <div className="mail-sidebar-section-label">AI Folders</div>
            {CAT_ORDER.map((cat) => {
              const count = catCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  className={`mail-sidebar-item mail-sidebar-item--category ${selectedFolder === cat ? "active" : ""} ${count === 0 ? "mail-sidebar-item--empty" : ""}`}
                  onClick={() => count > 0 ? selectFolder(cat) : undefined}
                  style={count === 0 ? { opacity: 0.38, cursor: "default" } : undefined}
                >
                  <span className="mail-sidebar-icon" aria-hidden>
                    <MailCategoryIcon cat={cat} className="mail-sidebar-icon-svg" />
                  </span>
                  <span className="mail-sidebar-label mail-sidebar-label--cap">{cat}</span>
                  {count > 0 && <span className="mail-sidebar-badge mail-sidebar-badge--muted">{count}</span>}
                </button>
              );
            })}
            {Object.keys(catCounts).length === 0 && (
              <p className="mail-folders-hint">Folders fill automatically; use AI Organize for smarter labels</p>
            )}
            <div className="mail-sidebar-divider" />
          </>

          {accounts.map((account) => (
            <div key={account.id} className="mail-sidebar-account-row">
              <button
                className={`mail-sidebar-item mail-sidebar-item--account ${selectedAccountId === account.id && !selectedFolder ? "active" : ""}`}
                onClick={() => { selectFolder(null); selectAccount(account.id); }}
                title={account.email}
              >
                <span className="mail-sidebar-icon" aria-hidden>
                  <MailProviderIcon provider={account.provider} />
                </span>
                <span className="mail-sidebar-label mail-sidebar-label--truncate">{account.label}</span>
              </button>
              <button type="button" className="mail-sidebar-remove" onClick={() => void removeAccount(account.id)} title="Remove account" aria-label="Remove account">
                <X size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
              </button>
            </div>
          ))}

          <div className="mail-sidebar-divider" />
          <button type="button" className="mail-sidebar-add" onClick={() => void addGmailAccount()}>
            <Plus size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            Add Gmail
          </button>
          <button type="button" className="mail-sidebar-add" onClick={() => void addOutlookAccount()}>
            <Plus size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            Add Outlook
          </button>
          <p className="mail-sidebar-hint">
            Outlook personal accounts usually work with one sign-in. Work or school accounts may need IT
            approval once — or use Gmail, which does not require admin consent.
          </p>
          <button type="button" className="mail-sidebar-add" onClick={() => setShowImapModal(true)}>
            <Plus size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
            Add IMAP/SMTP
          </button>
        </aside>

        {/* ── Message list ── */}
        <div className="mail-list-pane">
          <div className="mail-search-bar">
            <Search size={16} strokeWidth={MAIL_ICON_STROKE} className="mail-search-icon" aria-hidden />
            <input
              className="mail-search-input"
              placeholder="Search mail…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search mail"
            />
            {searchQuery && (
              <button type="button" className="mail-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
                <X size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
              </button>
            )}
          </div>
          {selectedFolder && (
            <div className="mail-folder-header">
              <span className="mail-folder-header-title">
                <MailCategoryIcon cat={selectedFolder} className="mail-folder-header-icon" />
                <span className="mail-sidebar-label--cap">{selectedFolder}</span>
              </span>
              <button type="button" className="btn-ghost btn-sm mail-toolbar-btn" onClick={() => selectFolder(null)}>
                <X size={14} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
                Clear
              </button>
            </div>
          )}
          {loading ? (
            <p className="page-loading">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className="mail-empty-state">
              <Mail size={48} strokeWidth={1.5} className="mail-empty-state-icon" aria-hidden />
              <h2>No mail accounts</h2>
              <p>Add a Gmail account or connect via IMAP/SMTP to get started.</p>
              <div className="mail-empty-actions">
                <button className="btn-primary" onClick={() => void addGmailAccount()}>Connect Gmail</button>
                <button className="btn-ghost" onClick={() => setShowImapModal(true)}>Add IMAP/SMTP</button>
              </div>
            </div>
          ) : filteredMessages.length === 0 ? (
            selectedFolder ? (
              <div className="mail-folder-empty">
                <MailCategoryIcon cat={selectedFolder} className="mail-folder-empty-icon" />
                <p className="mail-sidebar-label--cap">{selectedFolder}</p>
                <p>No messages here yet</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="mail-inbox-empty">
                <CheckCircle2 size={40} strokeWidth={1.75} className="mail-inbox-empty-check" aria-hidden />
                <p>Your inbox is empty</p>
              </div>
            ) : (
              <p className="gmail-empty">No messages match your search</p>
            )
          ) : (
            filteredMessages.map((msg) => {
              const av = senderAvatar(msg.from);
              const cat = msgCategory(msg.id);
              const unread = isUnread(msg);
              return (
                <div
                  key={`${msg.accountId}:${msg.id}`}
                  className={`gmail-row ${unread ? "unread" : ""} ${selectedMessage?.id === msg.id ? "selected" : ""}`}
                  onClick={() => void openMessage(msg)}
                >
                  <div className="mail-sender-avatar" style={{ background: av.color }}>{av.initial}</div>
                  <div className="gmail-row-body">
                    <div className="gmail-row-top">
                      <span className="gmail-row-from">{senderName(msg.from)}</span>
                      <div className="mail-row-meta">
                        {cat && (
                          <span className="mail-cat-badge" title={cat}>
                            <MailCategoryIcon cat={cat} />
                          </span>
                        )}
                        {accounts.length > 1 && selectedAccountId === "all" && (
                          <span className="mail-row-account">
                            {String(msg.accountEmail ?? "account").split("@")[0]}
                          </span>
                        )}
                        {msg.date && <span className="gmail-row-date">{fmtDate(msg.date)}</span>}
                      </div>
                    </div>
                    <p className="gmail-row-subject">{msg.subject || "(no subject)"}</p>
                    <p className="gmail-row-snippet">{msg.snippet}</p>
                  </div>
                  <div className="gmail-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="gmail-action-btn gmail-action-btn--archive"
                      onClick={() => void archive(msg)}
                      disabled={actionBusy === msg.id}
                      title="Archive"
                      aria-label="Archive"
                    >
                      <Archive size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {!loading && messages.length > 0 && inboxLimit < INBOX_LIMIT_MAX && (
            <div className="mail-load-more">
              <button type="button" className="btn-ghost btn-sm mail-toolbar-btn" onClick={loadMoreInbox}>
                Load more ({inboxLimit} of up to {INBOX_LIMIT_MAX})
              </button>
            </div>
          )}
        </div>

        {/* ── Preview pane ── */}
        <div className="gmail-preview">
          {selectedMessage ? (
            <>
              <div className="gmail-preview-header">
                <p className="gmail-preview-subject">{selectedMessage.subject || "(no subject)"}</p>
                <div className="mail-preview-header-sender">
                  {(() => {
                    const av = senderAvatar(selectedMessage.from);
                    const name = senderName(selectedMessage.from);
                    const emailMatch = selectedMessage.from.match(/<([^>]+)>/);
                    const emailAddr = emailMatch ? emailMatch[1] : selectedMessage.from;
                    return (
                      <>
                        <div className="mail-preview-avatar" style={{ background: av.color }}>{av.initial}</div>
                        <div className="mail-preview-sender-info">
                          <div className="mail-preview-sender-name">{name}</div>
                          <div className="mail-preview-sender-email">{emailAddr}</div>
                        </div>
                        <div className="mail-preview-date">{fmtDateFull(selectedMessage.date)}</div>
                      </>
                    );
                  })()}
                </div>
                {fullMessage?.to && <p className="mail-preview-to">To: {fullMessage.to}</p>}
                <div className="mail-preview-header-divider" />
                <div className="gmail-preview-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-sm mail-toolbar-btn"
                    onClick={() => { setReplyTo(selectedMessage); setComposeInitialBody(undefined); setComposing(true); }}
                  >
                    <Reply size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
                    Reply
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm mail-toolbar-btn"
                    onClick={() => void aiDraftReply()}
                    disabled={draftingReply || msgLoading}
                    title="Let AI draft a reply"
                  >
                    <Sparkles size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
                    {draftingReply ? "Drafting…" : "AI Reply"}
                  </button>
                  <button
                    className="btn-ghost btn-sm btn-mark-unread"
                    onClick={() => {
                      const id = selectedMessage.id;
                      setLocalUnread(prev => {
                        const next = new Set(prev);
                        if (isUnread(selectedMessage)) {
                          next.delete(id);
                          next.add(`read:${id}`);
                        } else {
                          next.delete(`read:${id}`);
                          next.add(id);
                        }
                        return next;
                      });
                    }}
                  >
                    {isUnread(selectedMessage) ? "Mark read" : "Mark unread"}
                  </button>
                  <button type="button" className="btn-ghost btn-sm mail-toolbar-btn" onClick={() => void archive(selectedMessage)}>
                    <Archive size={16} strokeWidth={MAIL_ICON_STROKE} aria-hidden />
                    Archive
                  </button>
                </div>
              </div>
              <div className="gmail-preview-body mail-preview-body">
                {msgLoading ? (
                  <p className="page-loading">Loading…</p>
                ) : fullMessage?.body ? (
                  fullMessage.mimeType?.includes("html") ? (
                    <iframe className="mail-preview-iframe" srcDoc={fullMessage.body} sandbox="allow-same-origin" title="Email body" />
                  ) : (
                    <pre className="mail-preview-text">{fullMessage.body}</pre>
                  )
                ) : (
                  <p className="gmail-preview-snippet">{selectedMessage.snippet}</p>
                )}
              </div>
            </>
          ) : (
            <div className="gmail-preview-empty"><p>Select an email to preview</p></div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showImapModal && <AddImapModal onClose={() => setShowImapModal(false)} onAdded={() => { void loadAccounts(); void loadInbox(selectedAccountId); }} />}

      {composing && (
        <ComposeModal
          accounts={accounts}
          defaultAccountId={selectedAccountId !== "all" ? selectedAccountId : accounts[0]?.id}
          replyTo={replyTo}
          initialBody={composeInitialBody}
          onClose={() => { setComposing(false); setReplyTo(undefined); setComposeInitialBody(undefined); }}
          onSent={() => void loadInbox(selectedAccountId)}
        />
      )}
    </div>
  );
};
