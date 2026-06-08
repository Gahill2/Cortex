/** Apple-style easing — fast out, gentle settle */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Slight overshoot spring (UIKit-like) */
export function springOut(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export type RafAnimationHandle = { cancel: () => void };

export function runRafAnimation(
  durationMs: number,
  ease: (t: number) => number,
  onFrame: (t: number) => void,
  onDone?: () => void,
): RafAnimationHandle {
  const start = performance.now();
  let raf = 0;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
  const step = (now: number) => {
    if (cancelled) return;
    const raw = clamp01((now - start) / durationMs);
    const t = ease(raw);
    onFrame(t);
    if (raw < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone?.();
    }
  };
  raf = requestAnimationFrame(step);
  return { cancel };
}
