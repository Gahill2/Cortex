import type { CanvasNode } from "./CanvasDashboard";

interface Props {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
}

const MAP_W = 160;
const MAP_H = 100;
const PADDING = 40;

export function CanvasMinimap({ nodes, pan, zoom, viewportWidth, viewportHeight }: Props) {
  if (nodes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }

  minX -= PADDING; minY -= PADDING;
  maxX += PADDING; maxY += PADDING;

  const worldW = Math.max(maxX - minX, 1);
  const worldH = Math.max(maxY - minY, 1);
  const scale = Math.min(MAP_W / worldW, MAP_H / worldH);

  const vx = (-pan.x / zoom - minX) * scale;
  const vy = (-pan.y / zoom - minY) * scale;
  const vw = (viewportWidth / zoom) * scale;
  const vh = (viewportHeight / zoom) * scale;

  return (
    <div className="canvas-minimap" style={{ width: MAP_W, height: MAP_H }}>
      <svg width={MAP_W} height={MAP_H} className="canvas-minimap__svg">
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={(n.x - minX) * scale}
            y={(n.y - minY) * scale}
            width={n.w * scale}
            height={n.h * scale}
            rx={1.5}
            className="canvas-minimap__node"
          />
        ))}
        <rect
          x={vx}
          y={vy}
          width={vw}
          height={vh}
          className="canvas-minimap__viewport"
        />
      </svg>
    </div>
  );
}
