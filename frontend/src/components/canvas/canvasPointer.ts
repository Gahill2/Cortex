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
        ".canvas-item__resize",
        ".at-glance__chip",
        ".at-glance__link",
        ".widget--today__chip",
      ].join(", "),
    ),
  );
}

/** In customize mode, pointer-down on the widget tile body should drag (not navigate). */
export function isCanvasDragSurface(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest(".canvas-item--edit-mode")) return false;
  if (el.closest(".canvas-item__header, .canvas-item__resize, .canvas-item__backdrop-chrome")) {
    return false;
  }
  return Boolean(el.closest(".canvas-item__body, .canvas-item__backdrop-fill"));
}
