import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="page-titlebar page-header">
      <div className="page-header__left">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="page-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="page-breadcrumbs__item">
                  {i > 0 && (
                    <span className="page-breadcrumbs__sep" aria-hidden="true">
                      /
                    </span>
                  )}
                  {!isLast && crumb.href ? (
                    <Link to={crumb.href} className="page-breadcrumbs__link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "page-breadcrumbs__current"
                          : "page-breadcrumbs__link"
                      }
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
