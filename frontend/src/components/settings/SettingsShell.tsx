import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import {
  SETTINGS_NAV_GROUPS,
  SETTINGS_SECTION_LABELS,
  type SettingsSectionId,
} from "../../settingsNavigation";

interface Props {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  children: React.ReactNode;
}

export function SettingsShell({ active, onChange, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const select = (id: SettingsSectionId) => {
    onChange(id);
    setMenuOpen(false);
  };

  const sidebar = (
    <aside className="settings-shell__sidebar" aria-label="Settings categories">
      <div className="settings-shell__sidebar-head">
        <p className="settings-shell__sidebar-title">Settings</p>
        <button
          type="button"
          className="settings-shell__sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close settings menu"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <nav className="settings-shell__nav">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.label} className="settings-shell__group">
            <p className="settings-shell__group-label">{group.label}</p>
            <ul className="settings-shell__list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`settings-shell__nav-item${isActive ? " is-active" : ""}`}
                      onClick={() => select(item.id)}
                    >
                      <Icon size={18} strokeWidth={1.75} className="settings-shell__nav-icon" aria-hidden />
                      <span className="settings-shell__nav-label">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="settings-shell">
      {menuOpen && (
        <button
          type="button"
          className="settings-shell__backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close settings menu"
        />
      )}

      <div className={`settings-shell__sidebar-wrap${menuOpen ? " is-open" : ""}`}>{sidebar}</div>

      <div className="settings-shell__main">
        <header className="settings-shell__header">
          <button
            type="button"
            className="settings-shell__menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open settings menu"
          >
            <Menu size={20} strokeWidth={1.75} aria-hidden />
          </button>
          <h1 className="settings-shell__page-title">{SETTINGS_SECTION_LABELS[active]}</h1>
        </header>
        <div className="settings-shell__content">{children}</div>
      </div>
    </div>
  );
}
