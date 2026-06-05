import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message?: string;
  /** Optional primary CTA rendered below the message. */
  action?: EmptyStateAction;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, message, action, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={32} strokeWidth={1.5} className="empty-state-icon" aria-hidden /> : null}
      {title ? <p className="empty-state-title">{title}</p> : null}
      {message ? <p className="empty-state-message">{message}</p> : null}
      {action ? (
        <button type="button" className="btn btn--primary empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      {children}
    </div>
  );
}
