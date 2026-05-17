interface Props {
  title: string;
  onOpenMenu: () => void;
}

export const MobileAppBar = ({ title, onOpenMenu }: Props) => (
  <header className="mobile-app-bar">
    <button
      type="button"
      className="mobile-app-bar__menu-btn"
      onClick={onOpenMenu}
      aria-label="Open menu"
    >
      <span className="mobile-app-bar__burger" aria-hidden>
        <span className="mobile-app-bar__burger-line" />
        <span className="mobile-app-bar__burger-line" />
        <span className="mobile-app-bar__burger-line" />
      </span>
    </button>
    <h1 className="mobile-app-bar__title">{title}</h1>
    <div className="mobile-app-bar__spacer" aria-hidden />
  </header>
);
