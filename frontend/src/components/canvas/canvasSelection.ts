/** Prevent the browser’s blue drag-selection overlay on canvas interactions. */
export function clearNativeSelection(): void {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) sel.removeAllRanges();
}
