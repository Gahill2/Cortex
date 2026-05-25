import fs from "fs/promises";
import path from "node:path";
import { basenameNoteId, extractWikilinks, normalizeNoteId } from "./wikilink-parser.js";

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface VaultGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    totalNodes: number;
    totalEdges: number;
    limited: boolean;
    nodeLimit: number;
  };
}

export interface BuildVaultGraphOptions {
  vaultPath: string;
  query?: string;
  focus?: string;
  nodeLimit?: number;
}

export interface VaultNoteRecord {
  id: string;
  label: string;
  path: string;
  content: string;
}

export async function walkMarkdown(vaultPath: string): Promise<VaultNoteRecord[]> {
  const notes: VaultNoteRecord[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const rel = path.relative(vaultPath, full).replace(/\\/g, "/");
      const content = await fs.readFile(full, "utf8").catch(() => "");
      const label = entry.name.replace(/\.md$/, "");
      notes.push({
        id: normalizeNoteId(rel),
        label,
        path: rel,
        content,
      });
    }
  }

  await walk(vaultPath);
  return notes;
}

export function resolveLinkTarget(
  link: string,
  byId: Map<string, VaultNoteRecord>,
  byBasename: Map<string, VaultNoteRecord>
): string | null {
  const norm = normalizeNoteId(link);
  const direct = byId.get(norm);
  if (direct) return direct.id;

  const base = basenameNoteId(link);
  const byName = byBasename.get(base);
  if (byName) return byName.id;

  return null;
}

function matchesQuery(note: VaultNoteRecord, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    note.label.toLowerCase().includes(lower) ||
    note.path.toLowerCase().includes(lower) ||
    note.content.toLowerCase().includes(lower)
  );
}

function collectNeighborhood(
  focusId: string,
  adjacency: Map<string, Set<string>>,
  depth = 2
): Set<string> {
  const visited = new Set<string>([focusId]);
  let frontier = new Set<string>([focusId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.add(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

export async function buildVaultGraph(options: BuildVaultGraphOptions): Promise<VaultGraph> {
  const nodeLimit = options.nodeLimit ?? 500;
  const notes = await walkMarkdown(options.vaultPath);

  const byId = new Map<string, VaultNoteRecord>();
  const byBasename = new Map<string, VaultNoteRecord>();
  for (const note of notes) {
    byId.set(note.id, note);
    const base = basenameNoteId(note.path);
    if (!byBasename.has(base)) byBasename.set(base, note);
  }

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const note of notes) {
    const links = extractWikilinks(note.content);
    for (const link of links) {
      const targetId = resolveLinkTarget(link, byId, byBasename);
      if (!targetId || targetId === note.id) continue;
      const key = `${note.id}→${targetId}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ source: note.id, target: targetId });
    }
  }

  let candidateIds = new Set(notes.map((n) => n.id));

  if (options.query?.trim()) {
    const q = options.query.trim();
    candidateIds = new Set(notes.filter((n) => matchesQuery(n, q)).map((n) => n.id));
  }

  if (options.focus?.trim()) {
    const focusId = normalizeNoteId(options.focus.trim());
    const resolved = byId.get(focusId) ?? byBasename.get(basenameNoteId(options.focus.trim()));
    if (resolved) {
      const adjacency = new Map<string, Set<string>>();
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
        if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
      }
      const hood = collectNeighborhood(resolved.id, adjacency);
      if (options.query?.trim()) {
        candidateIds = new Set([...candidateIds].filter((id) => hood.has(id)));
      } else {
        candidateIds = hood;
      }
    }
  }

  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    if (!candidateIds.has(edge.source) && !candidateIds.has(edge.target)) continue;
    if (candidateIds.has(edge.source)) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    }
    if (candidateIds.has(edge.target)) {
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
  }

  let filteredNotes = notes.filter((n) => candidateIds.has(n.id));
  filteredNotes.sort((a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0));

  const limited = filteredNotes.length > nodeLimit;
  if (limited) {
    filteredNotes = filteredNotes.slice(0, nodeLimit);
  }

  const allowed = new Set(filteredNotes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => allowed.has(e.source) && allowed.has(e.target));

  const nodes: GraphNode[] = filteredNotes.map((n) => ({
    id: n.id,
    label: n.label,
    path: n.path,
    degree: degreeMap.get(n.id) ?? 0,
  }));

  return {
    nodes,
    edges: filteredEdges,
    meta: {
      totalNodes: notes.length,
      totalEdges: edges.length,
      limited,
      nodeLimit,
    },
  };
}
