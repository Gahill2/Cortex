import type { CanvasNode } from "./CanvasDashboard";

export function computeFitView(
  nodes: CanvasNode[],
  viewportW: number,
  viewportH: number,
  padding = 72,
): { pan: { x: number; y: number }; zoom: number } {
  if (nodes.length === 0 || viewportW < 1 || viewportH < 1) {
    return { pan: { x: 0, y: 0 }, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }

  const contentW = maxX - minX + padding * 2;
  const contentH = maxY - minY + padding * 2;
  const zoom = Math.min(viewportW / contentW, viewportH / contentH, 1.5);
  const pan = {
    x: (viewportW - contentW * zoom) / 2 - minX * zoom + padding * zoom,
    y: (viewportH - contentH * zoom) / 2 - minY * zoom + padding * zoom,
  };

  return { pan, zoom };
}
