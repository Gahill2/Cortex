import { formatAppVersionLabel, formatAppVersionTooltip } from "../lib/buildInfo";

interface Props {
  className?: string;
}

/** Subtle build stamp — hover for full metadata (SHA, SW cache, build time). */
export function AppVersionBadge({ className }: Props) {
  return (
    <div
      className={className ? `app-version-badge ${className}` : "app-version-badge"}
      title={formatAppVersionTooltip()}
      aria-label={formatAppVersionTooltip()}
    >
      {formatAppVersionLabel()}
    </div>
  );
}
