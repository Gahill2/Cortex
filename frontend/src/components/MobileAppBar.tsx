import { CortexBrand } from "./brand/CortexBrand";

interface Props {
  onOpenMenu: () => void;
}

export const MobileAppBar = ({ onOpenMenu }: Props) => (
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
    <div className="mobile-app-bar__brand">
      <CortexBrand variant="appbar" />
    </div>
    <div className="mobile-app-bar__spacer" aria-hidden />
  </header>
);
