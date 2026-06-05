import { Film, HardDrive } from "lucide-react";
import type { Tab } from "../../../App";
import { useHomelabQuickStatus, type HomelabServiceHealth } from "../../../hooks/useHomelabQuickStatus";

const MEDIA_ORDER = ["jellyfin", "radarr", "sonarr", "qbittorrent", "prowlarr", "immich"] as const;

function healthLabel(health: HomelabServiceHealth): string {
  if (health === "ok") return "Up";
  if (health === "warn") return "Warn";
  if (health === "down") return "Down";
  if (health === "skipped") return "—";
  return "?";
}

function healthClass(health: HomelabServiceHealth): string {
  if (health === "ok") return "media-status__health--ok";
  if (health === "warn") return "media-status__health--warn";
  if (health === "down") return "media-status__health--down";
  return "media-status__health--unknown";
}

export function MediaStatusWidget({
  onNavigate,
  compact,
}: {
  onNavigate: (t: Tab) => void;
  compact?: boolean;
}) {
  const { status, loading } = useHomelabQuickStatus();

  const mediaRank = (id: string) => {
    const i = (MEDIA_ORDER as readonly string[]).indexOf(id);
    return i >= 0 ? i : 99;
  };
  const ordered = status?.mediaServices.slice().sort((a, b) => mediaRank(a.id) - mediaRank(b.id)) ?? [];

  const limit = compact ? 4 : 6;
  const shown = ordered.slice(0, limit);

  return (
    <div
      className="widget widget--media-status"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate("homelab")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate("homelab");
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="media-status__head">
        <Film size={16} aria-hidden />
        <span>Media & downloads</span>
      </div>

      {loading ? (
        <p className="media-status__muted">Checking stack…</p>
      ) : status ? (
        <>
          <ul className="media-status__grid">
            {shown.map((s) => (
              <li key={s.id} className="media-status__item">
                <span className="media-status__name">{s.name}</span>
                <span className={`media-status__health ${healthClass(s.health)}`}>{healthLabel(s.health)}</span>
              </li>
            ))}
          </ul>
          {!compact && (
            <div className="media-status__summary">
              <span>
                {status.mediaOk}/{status.mediaTotal} media services up
              </span>
              {status.downloadHeadroomHuman ? (
                <span className="media-status__storage">
                  <HardDrive size={12} aria-hidden />
                  {status.downloadHeadroomHuman} download space
                </span>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <p className="media-status__muted">Open Homelab for full status</p>
      )}
    </div>
  );
}
