interface Props {
  title: string;
  action?: React.ReactNode;
  subtitle?: string;
  eyebrow?: string;
}

export function PdSectionHeader({ title, action, subtitle, eyebrow }: Props) {
  return (
    <header className="pd-section-header">
      <div className="pd-section-header__text">
        {eyebrow ? <span className="pd-section-header__eyebrow">{eyebrow}</span> : null}
        <h3 className="pd-section-header__title">{title}</h3>
        {subtitle ? <p className="pd-section-header__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="pd-section-header__action">{action}</div> : null}
    </header>
  );
}
