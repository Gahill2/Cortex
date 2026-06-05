import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ProductivitySidebar({ title, children, footer, className = "" }: Props) {
  return (
    <div className={`pd-sidebar${className ? ` ${className}` : ""}`}>
      {title ? <p className="pd-sidebar__title">{title}</p> : null}
      <div className="pd-sidebar__body">{children}</div>
      {footer ? <div className="pd-sidebar__footer">{footer}</div> : null}
    </div>
  );
}

interface NavItemProps {
  icon?: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  indent?: boolean;
  onClick: () => void;
}

export function SidebarNavItem({ icon, label, count, active, indent, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      className={`pd-sidebar-nav${active ? " pd-sidebar-nav--active" : ""}${indent ? " pd-sidebar-nav--indent" : ""}`}
      onClick={onClick}
    >
      {icon ? <span className="pd-sidebar-nav__icon">{icon}</span> : null}
      <span className="pd-sidebar-nav__label">{label}</span>
      {count !== undefined ? <span className="pd-sidebar-nav__count">{count}</span> : null}
    </button>
  );
}

export function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pd-sidebar-section">
      <p className="pd-sidebar-section__label">{label}</p>
      <div className="pd-sidebar-section__items">{children}</div>
    </div>
  );
}
