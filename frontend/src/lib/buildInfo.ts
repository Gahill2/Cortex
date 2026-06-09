/** Baked at build time via vite.config.ts (git SHA, SW cache id, package version). */
export const BUILD_INFO = {
  version: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
  sha: import.meta.env.VITE_BUILD_SHA ?? "dev",
  builtAt: import.meta.env.VITE_BUILD_TIME ?? "",
  sw: import.meta.env.VITE_SW_VERSION ?? "unknown",
} as const;

/** Short label for badges: `v1.0.0 · 40c4b83` */
export function formatAppVersionLabel(): string {
  return `v${BUILD_INFO.version} · ${BUILD_INFO.sha}`;
}

/** One-line tooltip with full build metadata. */
export function formatAppVersionTooltip(): string {
  const parts = [
    `Cortex v${BUILD_INFO.version}`,
    `build ${BUILD_INFO.sha}`,
    `cache ${BUILD_INFO.sw}`,
  ];
  if (BUILD_INFO.builtAt) parts.push(`built ${BUILD_INFO.builtAt}`);
  return parts.join(" · ");
}
