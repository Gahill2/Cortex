import { clearNativeSelection } from "./canvasSelection";

/** Call before canvas drag / pan / resize to avoid native text/image selection. */
export function prepareCanvasPointerGesture(e: { preventDefault(): void }): void {
  e.preventDefault();
  clearNativeSelection();
}

/** True when the event target is an editable/control region — don't start canvas drag. */
export function isInteractiveCanvasTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      [
        "button",
        "input",
        "textarea",
        "select",
        "a",
        "label",
        "[contenteditable='true']",
        ".canvas-item__variant-popover",
        ".widget-style-picker",
        ".canvas-item__style-btn",
        ".canvas-item__backdrop-chrome",
        ".canvas-item__header",
      ].join(", "),
    ),
  );
}
