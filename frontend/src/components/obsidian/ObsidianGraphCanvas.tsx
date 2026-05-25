import { useEffect, useMemo, useRef, useState } from "react";

export type GraphNode = { id: string; label: string; path: string; degree: number };
export type GraphEdge = { source: string; target: string };
export type VaultGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: { totalNodes: number; totalEdges: number; limited: boolean; nodeLimit: number };
};

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

const WIDTH = 900;
const HEIGHT = 560;

function initSimulation(nodes: GraphNode[], edges: GraphEdge[]): SimNode[] {
  const simNodes: SimNode[] = nodes.map((n, i) => {
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    const r = 120 + (n.degree % 8) * 12;
    return {
      ...n,
      x: WIDTH / 2 + Math.cos(angle) * r,
      y: HEIGHT / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map(simNodes.map((n) => [n.id, n]));
  for (let tick = 0; tick < 80; tick++) {
    for (const edge of edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist - 90) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const rep = 4200 / (dist * dist);
        const fx = (dx / dist) * rep;
        const fy = (dy / dist) * rep;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
    for (const n of simNodes) {
      n.vx += (WIDTH / 2 - n.x) * 0.001;
      n.vy += (HEIGHT / 2 - n.y) * 0.001;
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
    }
  }
  return simNodes;
}

type Props = {
  graph: VaultGraph | null;
  loading: boolean;
  selectedId: string | null;
  onSelect: (node: GraphNode | null) => void;
  focusPath?: string | null;
};

export function ObsidianGraphCanvas({ graph, loading, selectedId, onSelect, focusPath }: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  const simNodes = useMemo(() => {
    if (!graph?.nodes.length) return [] as SimNode[];
    return initSimulation(graph.nodes, graph.edges);
  }, [graph]);

  const nodeById = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  useEffect(() => {
    if (!focusPath || !graph) return;
    const match = graph.nodes.find((n) => n.path === focusPath || n.id === focusPath);
    if (match) onSelect(match);
  }, [focusPath, graph, onSelect]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.min(2.5, Math.max(0.35, z * delta)));
  };

  if (loading) {
    return (
      <div className="notes-graph-canvas notes-graph-canvas--loading">
        <span className="inline-loading-spinner" aria-hidden="true" /> Building graph…
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="notes-graph-canvas notes-graph-canvas--empty">
        <p>No notes in this vault yet, or vault path is not reachable from the API.</p>
      </div>
    );
  }

  return (
    <div
      className="notes-graph-canvas"
      onWheel={onWheel}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".notes-graph-node")) return;
        dragRef.current = { active: true, x: e.clientX - pan.x, y: e.clientY - pan.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
    >
      {graph.meta.limited && (
        <p className="notes-graph-hint">
          Showing {graph.nodes.length} of {graph.meta.totalNodes} notes ({graph.meta.totalEdges} links).
        </p>
      )}
      <svg
        className="notes-graph-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <g className="notes-graph-edges">
          {graph.edges.map((edge) => {
            const a = nodeById.get(edge.source);
            const b = nodeById.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="notes-graph-edge"
              />
            );
          })}
        </g>
        <g className="notes-graph-nodes">
          {simNodes.map((node) => {
            const active = selectedId === node.id;
            const r = 4 + Math.min(node.degree, 12);
            return (
              <g
                key={node.id}
                className={`notes-graph-node ${active ? "is-active" : ""}`}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelect(node)}
                style={{ cursor: "pointer" }}
              >
                <circle r={r} className="notes-graph-node-dot" />
                {active && (
                  <text y={r + 12} textAnchor="middle" className="notes-graph-node-label">
                    {node.label.length > 28 ? `${node.label.slice(0, 26)}…` : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
