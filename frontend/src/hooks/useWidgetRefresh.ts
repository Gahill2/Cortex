import { useEffect, useRef } from "react";

/**
 * Calls `callback` on a recurring interval, but only when the document tab is
 * visible. The interval is cleared on unmount and paused whenever the tab is
 * hidden so we don't hammer the API while the user is away.
 */
export function useWidgetRefresh(callback: () => void, intervalMs: number): void {
  // Keep a stable ref so the interval closure always calls the latest callback
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timerId !== null) return;
      timerId = setInterval(() => {
        if (document.visibilityState === "visible") {
          callbackRef.current();
        }
      }, intervalMs);
    };

    const stop = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    // Only run when visible
    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
