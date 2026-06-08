type ElectronWindow = Window & {
  electron?: {
    openExternal?: (url: string) => Promise<void>;
  };
};

/**
 * Open a URL in the system browser or a new tab.
 * Electron: system browser. Web: window.open, then <a click> fallback (iOS Safari).
 */
export function openExternalUrl(url: string): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  } catch {
    return false;
  }

  const win = window as ElectronWindow;
  if (win.electron?.openExternal) {
    void win.electron.openExternal(trimmed);
    return true;
  }

  const popup = window.open(trimmed, "_blank", "noopener,noreferrer");
  if (popup) return true;

  const anchor = document.createElement("a");
  anchor.href = trimmed;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
