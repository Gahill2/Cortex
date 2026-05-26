import type { ReactNode } from "react";

interface Props {
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  className?: string;
}

/** Three-column productivity layout: sidebar · main · inspector. */
export function ProductivityShell({ left, main, right, className = "" }: Props) {
  return (
    <div className={`pd-shell${className ? ` ${className}` : ""}`}>
      {left ? <aside className="pd-shell__left">{left}</aside> : null}
      <div className="pd-shell__main">{main}</div>
      {right ? <aside className="pd-shell__right">{right}</aside> : null}
    </div>
  );
}
