import type { ReactNode } from "react";

interface Props {
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  className?: string;
  mobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  mobileInspectorOpen?: boolean;
  onMobileInspectorOpenChange?: (open: boolean) => void;
}

/** Three-column productivity layout: sidebar · main · inspector (mobile drawers). */
export function ProductivityShell({
  left,
  main,
  right,
  className = "",
  mobileSidebarOpen = false,
  onMobileSidebarOpenChange,
  mobileInspectorOpen = false,
  onMobileInspectorOpenChange,
}: Props) {
  const closeSidebar = () => onMobileSidebarOpenChange?.(false);
  const closeInspector = () => onMobileInspectorOpenChange?.(false);

  return (
    <div className={`pd-shell${className ? ` ${className}` : ""}`}>
      {left ? (
        <>
          {mobileSidebarOpen ? (
            <button type="button" className="pd-mobile-backdrop" onClick={closeSidebar} aria-label="Close menu" />
          ) : null}
          <aside
            className={`pd-shell__left${mobileSidebarOpen ? " pd-shell__left--drawer-open" : ""}`}
          >
            {left}
          </aside>
        </>
      ) : null}
      <div className="pd-shell__main">{main}</div>
      {right ? (
        <>
          {mobileInspectorOpen ? (
            <button
              type="button"
              className="pd-mobile-backdrop"
              onClick={closeInspector}
              aria-label="Close details"
            />
          ) : null}
          <aside
            className={`pd-shell__right${mobileInspectorOpen ? " pd-shell__right--drawer-open" : ""}`}
          >
            {right}
          </aside>
        </>
      ) : null}
    </div>
  );
}
