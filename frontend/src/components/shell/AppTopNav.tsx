import type { Tab } from "../../tab";
import { CORTEX_MAIN_NAV } from "../../navigation";
import { NavIcon } from "../NavIcon";
import { CortexBrand } from "../brand/CortexBrand";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onOpenPalette?: () => void;
}

/** Desktop-first horizontal nav — replaces burger drawer. */
export function AppTopNav({ active, onChange, onOpenPalette }: Props) {
  return (
    <header className="app-topnav" aria-label="Primary navigation">
      <div className="app-topnav__brand">
        <CortexBrand variant="appbar" />
      </div>
      <nav className="app-topnav__links" aria-label="App sections">
        {CORTEX_MAIN_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`app-topnav__link${active === item.id ? " app-topnav__link--active" : ""}`}
            onClick={() => onChange(item.id)}
            aria-current={active === item.id ? "page" : undefined}
          >
            <NavIcon name={item.icon} size={16} className="app-topnav__icon" />
            <span className="app-topnav__label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="app-topnav__actions">
        {onOpenPalette ? (
          <button
            type="button"
            className="app-topnav__cmd"
            onClick={onOpenPalette}
            title="Command palette (⌘K)"
            aria-label="Open command palette"
          >
            <span className="app-topnav__cmd-icon">⌘</span>
            <span className="app-topnav__cmd-hint">K</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
