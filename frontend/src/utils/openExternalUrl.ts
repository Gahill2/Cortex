/**
 * Open a URL in a new tab/window. iOS Safari often blocks `window.open`;
 * programmatic <a click> is more reliable from button handlers.
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

  const anchor = document.createElement("a");
  anchor.href = trimmed;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
