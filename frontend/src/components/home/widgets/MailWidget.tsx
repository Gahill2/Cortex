import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { Tab } from "../../../App";
import type { GmailMsg } from "./types";
import { BrandIcon } from "../../brand";
import { avatarColor } from "./utils";
import { Skeleton } from "../../ui/Skeleton";
import { useWidgetRefresh } from "../../../hooks/useWidgetRefresh";

export function MailWidget({
  onNavigate,
  compact = false,
}: {
  onNavigate: (t: Tab) => void;
  compact?: boolean;
}) {
  const [hasAccounts, setHasAccounts] = useState(false);
  const [messages, setMessages] = useState<GmailMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMail = useCallback(async (isRetry = false) => {
    if (isRetry) setLoadError(null);
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    try {
      const s = await api.get<{ data?: { accounts: { id: string }[] } }>("/mail/accounts");
      const accounts = s.data?.data?.accounts ?? [];
      if (cancelled) return cancel;
      setHasAccounts(accounts.length > 0);
      if (accounts.length === 0) { setLoading(false); return cancel; }
      const r = await api.get("/mail/inbox", { params: { unified: "true", maxResults: 8 } });
      if (cancelled) return cancel;
      setMessages(r.data?.data?.messages ?? []);
    } catch {
      if (!cancelled) setLoadError("Could not load mail");
    } finally {
      if (!cancelled) setLoading(false);
    }
    return cancel;
  }, []);

  useEffect(() => {
    let cancelFn: (() => void) | undefined;
    setLoading(true);
    void fetchMail().then((cancel) => { cancelFn = cancel; });
    return () => { cancelFn?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useWidgetRefresh(() => { void fetchMail(); }, 120_000);

  const unread = messages.filter((m) => m.unread).length;
  const previewLimit = compact ? 3 : 6;

  return (
    <div
      className={`widget widget--gmail${compact ? " widget--gmail-compact" : ""}`}
      onClick={() => onNavigate("mail")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate("mail");
        }
      }}
    >
      <div className="widget-label widget-label--brand">
        <BrandIcon brand="gmail" size={18} title="Gmail" />
        <span>Gmail</span>
        {unread > 0 && <span className="mail-unread-badge">{unread}</span>}
      </div>
      {loading ? (
        <Skeleton variant="table" lines={compact ? 3 : 5} style={{ marginTop: 8 }} />
      ) : loadError ? (
        <div className="widget-error-state">
          <p className="widget-empty">{loadError}</p>
          <button
            type="button"
            className="widget-retry-btn"
            onClick={(e) => { e.stopPropagation(); void fetchMail(true); }}
          >
            Retry
          </button>
        </div>
      ) : !hasAccounts ? (
        <div className="widget-cta">
          <p className="widget-cta-text">No accounts connected</p>
          <span className="widget-cta-link">Add account →</span>
        </div>
      ) : (
        <ul className="gmail-widget-list">
          {messages.slice(0, previewLimit).map((m) => {
            const fromRaw = m.from ?? "";
            const senderName = fromRaw.split("<")[0].trim() || fromRaw || "Unknown";
            const initial = (senderName.charAt(0) || "?").toUpperCase();
            return (
              <li key={m.id} className={`gmail-row-v2 ${m.unread ? "unread" : ""}`}>
                <div className="mail-avatar" style={{ background: avatarColor(senderName) }}>
                  {initial}
                </div>
                <div className="gmail-row-content">
                  <div className="gmail-row-from">{senderName.slice(0, 22)}</div>
                  <div className="gmail-row-subject">{m.subject || "(no subject)"}</div>
                </div>
              </li>
            );
          })}
          {messages.length === 0 && <li className="widget-empty">Inbox empty</li>}
        </ul>
      )}
      {!compact && <div className="widget-open-hint">Open Mail →</div>}
    </div>
  );
}
