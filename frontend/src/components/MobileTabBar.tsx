import type { Tab } from "../App";
import { CORTEX_MOBILE_TAB_NAV } from "../navigation";
import { NavIcon } from "./NavIcon";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function MobileTabBar({ active, onChange }: Props) {
  return (
    <nav className="mobile-tab-bar" aria-label="Primary">
      {CORTEX_MOBILE_TAB_NAV.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-tab-bar__item${isActive ? " is-active" : ""}`}
            onClick={() => onChange(item.id)}
            aria-current={isActive ? "page" : undefined}
          >
            <NavIcon name={item.icon} size={22} className="mobile-tab-bar__icon" />
            <span className="mobile-tab-bar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
