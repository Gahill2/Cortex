import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, message, action, className = "" }: Props) {
  return (
    <div className={`pd-empty${className ? ` ${className}` : ""}`}>
      {Icon ? (
        <div className="pd-empty__icon-wrap" aria-hidden>
          <Icon size={28} strokeWidth={1.5} className="pd-empty__icon" />
        </div>
      ) : null}
      <p className="pd-empty__title">{title}</p>
      <p className="pd-empty__message">{message}</p>
      {action ? <div className="pd-empty__action">{action}</div> : null}
    </div>
  );
}
