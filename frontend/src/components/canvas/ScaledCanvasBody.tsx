import { useEffect, useRef, useState, type ReactNode } from "react";

const MIN_SCALE = 0.55;
const MAX_SCALE = 2.75;

interface Props {
  baseWidth: number;
  baseHeight: number;
  className?: string;
  children: ReactNode;
}

/** Scales canvas item body content to match the item's rendered size (live during resize). */
export function ScaledCanvasBody({ baseWidth, baseHeight, className, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w <= 0 || h <= 0) return;
      const raw = Math.min(w / baseWidth, h / baseHeight);
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [baseWidth, baseHeight]);

  const hostClass = `canvas-item__scale-host${className ? ` ${className}` : ""}`;

  return (
    <div ref={hostRef} className={hostClass}>
      <div
        className="canvas-item__scale-inner"
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function canvasItemBaseSize(type: string): { w: number; h: number } {
  switch (type) {
    case "widget":
      return { w: 380, h: 260 };
    case "note":
      return { w: 280, h: 160 };
    case "custom":
      return { w: 320, h: 200 };
    case "text":
      return { w: 320, h: 100 };
    case "embed":
      return { w: 400, h: 300 };
    case "backdrop":
      return { w: 400, h: 280 };
    default:
      return { w: 320, h: 200 };
  }
}
