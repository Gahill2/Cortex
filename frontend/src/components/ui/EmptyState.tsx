import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, message, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={32} strokeWidth={1.5} className="empty-state-icon" aria-hidden /> : null}
      {title ? <p className="empty-state-title">{title}</p> : null}
      {message ? <p className="empty-state-message">{message}</p> : null}
      {children}
    </div>
  );
}
