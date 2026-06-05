import type { WidgetRenderProps } from "../types";
import { useDashboardDataContext } from "../hooks/useDashboardDataContext";
import { PdSectionHeader } from "../../components/ui/PdSectionHeader";

function senderLabel(from: string) {
  const name = from.split("<")[0].trim();
  return name || from || "Unknown";
}

export function EmailPreviewWidget(props: WidgetRenderProps) {
  const { mailMessages, hasMailAccounts, mailLoading, mailError } = useDashboardDataContext();
  const onNavigate = props.onNavigate;

  return (
    <div className="pd-widget pd-widget--email">
      <PdSectionHeader title={(props.settings.title as string) || "Mail"} />
      {mailLoading ? (
        <p className="pd-widget-empty">Loading mail…</p>
      ) : mailError ? (
        <p className="pd-widget-empty">{mailError}</p>
      ) : !hasMailAccounts ? (
        <div className="pd-widget-cta">
          <p className="pd-widget-cta-text">No mail accounts connected</p>
          {onNavigate ? (
            <button type="button" className="pd-widget-cta-link" onClick={() => onNavigate("mail")}>
              Connect in Mail →
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="pd-email-list">
          {mailMessages.length === 0 ? (
            <li className="pd-widget-empty">Inbox empty</li>
          ) : (
            mailMessages.slice(0, 6).map((m) => (
              <li key={m.id} className={m.unread ? "pd-email-list__item--unread" : ""}>
                <strong>{senderLabel(m.from)}</strong>
                <span>{m.subject || "(no subject)"}</span>
                {m.snippet ? <p>{m.snippet}</p> : null}
              </li>
            ))
          )}
        </ul>
      )}
      {onNavigate && hasMailAccounts ? (
        <button type="button" className="pd-widget-link" onClick={() => onNavigate("mail")}>
          Open Mail →
        </button>
      ) : null}
    </div>
  );
}
