import type { CanvasNode } from "../components/canvas/CanvasDashboard";
import { api, resolveCortexApiBaseURL } from "../api/client";

export const CANVAS_STORAGE_KEY = "cortex-canvas-state";

export interface CanvasPersistedState {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
}

export function loadCanvasFromLocalStorage(): CanvasPersistedState | null {
  try {
    const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CanvasPersistedState;
    if (!Array.isArray(parsed?.nodes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCanvasToLocalStorage(state: CanvasPersistedState): void {
  try {
    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — server sync may still succeed */
  }
}

export function parseCanvasLayout(raw: Record<string, unknown> | null | undefined): CanvasPersistedState | null {
  if (!raw || typeof raw !== "object") return null;
  const nodes = raw.nodes;
  if (!Array.isArray(nodes)) return null;
  const pan = raw.pan;
  const zoom = raw.zoom;
  return {
    nodes: nodes as CanvasNode[],
    pan:
      pan && typeof pan === "object" && "x" in pan && "y" in pan
        ? { x: Number((pan as { x: unknown }).x) || 0, y: Number((pan as { y: unknown }).y) || 0 }
        : { x: 0, y: 0 },
    zoom: typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 1,
  };
}

export function resolveCanvasImageSrc(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("data:") || /^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/api/")) {
    const origin = resolveCortexApiBaseURL().replace(/\/api\/?$/, "");
    return `${origin}${imageUrl}`;
  }
  return imageUrl;
}

export async function uploadCanvasDataUrl(dataUrl: string): Promise<string> {
  const res = await api.post<{ data: { imageUrl: string } }>("/canvas/images", { dataUrl });
  const imageUrl = res.data.data.imageUrl;
  if (!imageUrl) throw new Error("Upload did not return imageUrl");
  return imageUrl;
}

export async function migrateCanvasDataUrlImages(
  nodes: CanvasNode[],
  isAuthenticated: boolean
): Promise<CanvasNode[]> {
  if (!isAuthenticated) return nodes;
  let changed = false;
  const next = await Promise.all(
    nodes.map(async (node) => {
      if (node.type !== "image" || !node.imageUrl?.startsWith("data:")) return node;
      try {
        const imageUrl = await uploadCanvasDataUrl(node.imageUrl);
        changed = true;
        return { ...node, imageUrl };
      } catch {
        return node;
      }
    })
  );
  return changed ? next : nodes;
}
