import type { CSSProperties } from "react";

export type SkeletonVariant = "text" | "card" | "avatar" | "table";

interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Number of lines/rows — used by "text" and "table" variants */
  lines?: number;
  className?: string;
  style?: CSSProperties;
}

const shimmerStyle: CSSProperties = {
  background:
    "linear-gradient(90deg, var(--skeleton-base, rgba(128,128,128,0.12)) 25%, var(--skeleton-shine, rgba(128,128,128,0.22)) 50%, var(--skeleton-base, rgba(128,128,128,0.12)) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
  borderRadius: "var(--radius-sm, 4px)",
};

const injectKeyframes = (): void => {
  if (typeof document === "undefined") return;
  const id = "cortex-skeleton-keyframes";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
};

if (typeof window !== "undefined") {
  injectKeyframes();
}

export function Skeleton({ variant = "text", lines = 3, className = "", style }: SkeletonProps) {
  if (variant === "avatar") {
    return (
      <span
        className={`skeleton skeleton--avatar${className ? ` ${className}` : ""}`}
        aria-hidden="true"
        role="presentation"
        style={{
          ...shimmerStyle,
          display: "inline-block",
          width: 40,
          height: 40,
          borderRadius: "50%",
          ...style,
        }}
      />
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`skeleton skeleton--card${className ? ` ${className}` : ""}`}
        aria-hidden="true"
        role="presentation"
        style={{
          ...shimmerStyle,
          width: "100%",
          height: 120,
          borderRadius: "var(--radius-md, 8px)",
          ...style,
        }}
      />
    );
  }

  if (variant === "table") {
    const count = Math.max(1, lines);
    return (
      <div
        className={`skeleton skeleton--table${className ? ` ${className}` : ""}`}
        aria-hidden="true"
        role="presentation"
        style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyle,
              width: "100%",
              height: 36,
              borderRadius: "var(--radius-sm, 4px)",
            }}
          />
        ))}
      </div>
    );
  }

  // "text" variant — stacked lines, last line shorter
  const count = Math.max(1, lines);
  return (
    <div
      className={`skeleton skeleton--text${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      role="presentation"
      style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            ...shimmerStyle,
            width: i === count - 1 && count > 1 ? "65%" : "100%",
            height: 14,
          }}
        />
      ))}
    </div>
  );
}
