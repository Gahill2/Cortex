import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { CalendarConnectionStatus } from "../../lib/googleCalendarConnect";
import { connectGoogleCalendar } from "../../lib/googleCalendarConnect";

interface Props {
  status: CalendarConnectionStatus | null;
  warnings: string[];
  onNavigateMail?: () => void;
}

export function CalendarConnectBanner({ status, warnings, onNavigateMail }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const primaryBroken = status?.google.find((a) => a.isPrimary && a.needsReconnect);
  const anyBroken = status?.needsGoogleReconnect;
  const showReconnect = Boolean(anyBroken || warnings.some((w) => /reconnect|expired|permission/i.test(w)));

  if (!showReconnect && warnings.length === 0) return null;

  const onReconnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await connectGoogleCalendar();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not start Google sign-in.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="calendar-connect-banner" role="status">
      {primaryBroken ? (
        <p className="calendar-connect-banner__lead">
          <strong>{primaryBroken.email}</strong> needs to sign in again to load your Google Calendar
          events.
        </p>
      ) : showReconnect ? (
        <p className="calendar-connect-banner__lead">
          Reconnect Gmail to refresh calendar access (includes Google Calendar permission).
        </p>
      ) : null}
      {warnings.map((w) => (
        <p key={w} className="calendar-connect-banner__warn">
          {w}
        </p>
      ))}
      {connectError ? (
        <p className="calendar-connect-banner__error" role="alert">
          {connectError}
        </p>
      ) : null}
      <div className="calendar-connect-banner__actions">
        <button
          type="button"
          className="pd-btn pd-btn--primary pd-btn--sm"
          disabled={connecting}
          onClick={() => void onReconnect()}
        >
          <RefreshCw size={14} aria-hidden />
          {connecting ? "Opening Google…" : "Reconnect Google Calendar"}
        </button>
        {onNavigateMail ? (
          <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={onNavigateMail}>
            Open Mail
          </button>
        ) : null}
      </div>
    </div>
  );
}
