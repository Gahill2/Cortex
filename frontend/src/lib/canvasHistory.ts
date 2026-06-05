import type { CanvasNode } from "../components/canvas/CanvasDashboard";

export interface CanvasState {
  nodes: CanvasNode[];
  pan: { x: number; y: number };
  zoom: number;
}

export interface CanvasHistory {
  past: CanvasState[];
  future: CanvasState[];
}

const MAX_HISTORY = 50;

export function createHistory(): CanvasHistory {
  return { past: [], future: [] };
}

export function pushHistory(history: CanvasHistory, current: CanvasState): CanvasHistory {
  const past = [...history.past, current];
  return {
    past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past,
    future: [],
  };
}

export function undoHistory(
  history: CanvasHistory,
  current: CanvasState,
): { state: CanvasState; history: CanvasHistory } | null {
  if (history.past.length === 0) return null;
  const past = [...history.past];
  const state = past.pop()!;
  return {
    state,
    history: {
      past,
      future: [current, ...history.future],
    },
  };
}

export function redoHistory(
  history: CanvasHistory,
  current: CanvasState,
): { state: CanvasState; history: CanvasHistory } | null {
  if (history.future.length === 0) return null;
  const future = [...history.future];
  const state = future.shift()!;
  return {
    state,
    history: {
      past: [...history.past, current],
      future,
    },
  };
}
