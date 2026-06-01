import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className = "" }: Props) {
  return (
    <div className={`cortex-empty-state ${className}`.trim()} role="status">
      {icon ? <div className="cortex-empty-state__icon">{icon}</div> : null}
      <p className="cortex-empty-state__title">{title}</p>
      {description ? <p className="cortex-empty-state__desc">{description}</p> : null}
      {action ? <div className="cortex-empty-state__action">{action}</div> : null}
    </div>
  );
}
