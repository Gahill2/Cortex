import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
  interactive?: boolean;
}

export function PdCard({ children, className = "", padding = "md", interactive }: Props) {
  return (
    <div
      className={`pd-card pd-card--pad-${padding}${interactive ? " pd-card--interactive" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
