import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { VaultBrowser } from "../components/notes/VaultBrowser";
import { useToastStore } from "../stores/toastStore";

type Envelope<T> = { ok: boolean; data: T };

type GraphNode = { id: string; label: string; path: string; degree: number };
type GraphEdge = { source: string; target: string };
type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: { totalNodes: number; totalEdges: number; limited: boolean; nodeLimit: number };
};

type ObsidianFile = { name: string; path: string; modified: number; size: number };
type SearchRow = { name: string; path: string; excerpt: string };
type BacklinkRef = { path: string; label: string };
type VaultBacklinks = { path: string; incoming: BacklinkRef[]; outgoing: BacklinkRef[] };

type ElectronWin = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

function renderInlineMarkdown(
  text: string,
  onWikiLink?: (target: string) => void
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const target = (m[1] ?? "").trim();
    const label = (m[2] ?? m[1] ?? "").trim();
    parts.push(
      <button
        key={`wl-${k++}`}
        type="button"
        className="notes-wikilink"
        onClick={() => onWikiLink?.(target)}
      >
        {label}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function DocBody({ text, onWikiLink }: { text: string; onWikiLink?: (target: string) => void }) {
  if (!text.trim()) return <p className="notes-doc-empty">Empty note</p>;
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h1 key={i} className="notes-doc-h1">
          {renderInlineMarkdown(line.slice(2), onWikiLink)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="notes-doc-h2">
          {renderInlineMarkdown(line.slice(3), onWikiLink)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(
        <h3 key={i} className="notes-doc-h3">
          {renderInlineMarkdown(line.slice(4), onWikiLink)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*] /, ""));
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="notes-doc-ul">
          {items.map((it, j) => (
            <li key={j}>{renderInlineMarkdown(it, onWikiLink)}</li>
          ))}
        </ul>
      );
      continue;
    }
    let para = line;
    i++;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !(lines[i] ?? "").startsWith("#") &&
      !/^[-*] /.test(lines[i] ?? "")
    ) {
      para += "\n" + (lines[i] ?? "");
      i++;
    }
    out.push(
      <p key={`p-${i}`} className="notes-doc-p">
        {renderInlineMarkdown(para, onWikiLink)}
      </p>
    );
  }
  return <article className="notes-doc-body">{out}</article>;
}

function obsidianUri(vaultName: string, relPath: string): string {
  const file = relPath.replace(/\.md$/i, "");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(file)}`;
}

function KnowledgeGraph(props: {
  graph: GraphData | null;
  focusPath: string | null;
  onSelect: (node: GraphNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ panning: boolean; lastX: number; lastY: number }>({
    panning: false,
    lastX: 0,
    lastY: 0,
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!props.graph?.nodes.length) {
      simRef.current = [];
      setPositions(new Map());
      return;
    }

    const width = 900;
    const height = 600;
    const nodes: SimNode[] = props.graph.nodes.map((n, i) => {
      const angle = (i / props.graph!.nodes.length) * Math.PI * 2;
      const r = Math.min(width, height) * 0.28;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * r,
        y: height / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    simRef.current = nodes;

    const edges = props.graph.edges;
    let tick = 0;
    const maxTicks = 220;

    const step = () => {
      const simNodes = simRef.current;
      const centerX = width / 2;
      const centerY = height / 2;

      for (const a of simNodes) {
        for (const b of simNodes) {
          if (a.id === b.id) continue;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let distSq = dx * dx + dy * dy + 0.01;
          const force = 4200 / distSq;
          const dist = Math.sqrt(distSq);
          dx /= dist;
          dy /= dist;
          a.vx += dx * force;
          a.vy += dy * force;
        }
      }

      for (const edge of edges) {
        const s = simNodes.find((n) => n.id === edge.source);
        const t = simNodes.find((n) => n.id === edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 90) * 0.04;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      for (const n of simNodes) {
        n.vx += (centerX - n.x) * 0.002;
        n.vy += (centerY - n.y) * 0.002;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx;
        n.y += n.vy;
      }

      tick++;
      if (tick % 3 === 0 || tick >= maxTicks) {
        const next = new Map<string, { x: number; y: number }>();
        for (const n of simNodes) next.set(n.id, { x: n.x, y: n.y });
        setPositions(next);
      }
      if (tick < maxTicks) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [props.graph]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => ({ ...t, k: Math.min(3, Math.max(0.25, t.k * delta)) }));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(".brain-graph-node")) return;
    dragRef.current = { panning: true, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.panning) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };

  const onPointerUp = () => {
    dragRef.current.panning = false;
  };

  if (!props.graph?.nodes.length) {
    return (
      <div className="brain-graph-empty">
        <p>No notes in vault yet — add markdown files to see the graph.</p>
      </div>
    );
  }

  const focusId = props.focusPath?.toLowerCase().replace(/\.md$/i, "");

  return (
    <svg
      ref={svgRef}
      className="brain-graph-svg"
      viewBox="0 0 900 600"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
        {props.graph.edges.map((e, i) => {
          const s = positions.get(e.source);
          const t = positions.get(e.target);
          if (!s || !t) return null;
          return (
            <line
              key={`${e.source}-${e.target}-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              className="brain-graph-edge"
            />
          );
        })}
        {props.graph.nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const active = props.focusPath && (n.path === props.focusPath || n.id === focusId);
          const r = 6 + Math.min(n.degree, 12);
          return (
            <g
              key={n.id}
              className={`brain-graph-node${active ? " is-active" : ""}`}
              transform={`translate(${p.x}, ${p.y})`}
              onClick={() => props.onSelect(n)}
            >
              <circle r={r} className="brain-graph-node-dot" />
              <text y={r + 12} textAnchor="middle" className="brain-graph-node-label">
                {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export const NotesPage = () => {
  const pushToast = useToastStore((s) => s.push);
  const isElectron = !!(window as ElectronWin).electron?.isElectron;
  const openExternal = (url: string) => {
    if (isElectron) void (window as ElectronWin).electron!.openExternal!(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState("Grey Hill Brain");
  const [vaultInput, setVaultInput] = useState("");
  const [vaultSaving, setVaultSaving] = useState(false);
  const [envHint, setEnvHint] = useState(false);

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRow[]>([]);
  const [files, setFiles] = useState<ObsidianFile[]>([]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<VaultBacklinks | null>(null);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(true);

  const loadVault = useCallback(async () => {
    try {
      const r = await api.get<Envelope<{ path: string | null; name: string | null; envFallback?: boolean }>>(
        "/obsidian/vault"
      );
      const data = r.data?.data ?? r.data;
      setVaultPath(data?.path ?? null);
      if (data?.name) setVaultName(data.name);
      setEnvHint(Boolean(data?.envFallback));
      if (data?.path) setVaultInput(data.path);
    } catch {
      setVaultPath(null);
    }
  }, []);

  const loadGraph = useCallback(async (q?: string, focus?: string) => {
    if (!vaultPath) return;
    setGraphLoading(true);
    try {
      const r = await api.get<Envelope<GraphData>>("/obsidian/graph", {
        params: { ...(q ? { q } : {}), ...(focus ? { focus } : {}) },
      });
      setGraph(r.data?.data ?? null);
    } catch {
      setGraph(null);
    } finally {
      setGraphLoading(false);
    }
  }, [vaultPath]);

  const loadFiles = useCallback(async () => {
    if (!vaultPath) return;
    try {
      const r = await api.get<Envelope<{ files: ObsidianFile[] }>>("/obsidian/files");
      setFiles(r.data?.data?.files ?? []);
    } catch {
      setFiles([]);
    }
  }, [vaultPath]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  useEffect(() => {
    if (vaultPath) {
      void loadGraph();
      void loadFiles();
    }
  }, [vaultPath, loadGraph, loadFiles]);

  useEffect(() => {
    if (!vaultPath || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<Envelope<{ results: SearchRow[] }>>("/obsidian/search", {
          params: { q: searchQuery.trim() },
        });
        setSearchResults(r.data?.data?.results ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [searchQuery, vaultPath]);

  useEffect(() => {
    if (!selectedPath || !vaultPath) {
      setNoteContent(null);
      return;
    }
    let cancelled = false;
    setNoteLoading(true);
    void (async () => {
      try {
        const r = await api.get<Envelope<{ content: string }>>("/obsidian/file", {
          params: { path: selectedPath },
        });
        if (!cancelled) setNoteContent(r.data?.data?.content ?? "");
      } catch {
        if (!cancelled) setNoteContent(null);
      } finally {
        if (!cancelled) setNoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPath, vaultPath]);

  useEffect(() => {
    if (!selectedPath || !vaultPath) {
      setBacklinks(null);
      return;
    }
    let cancelled = false;
    setBacklinksLoading(true);
    void (async () => {
      try {
        const r = await api.get<Envelope<VaultBacklinks>>("/obsidian/backlinks", {
          params: { path: selectedPath },
        });
        if (!cancelled) setBacklinks(r.data?.data ?? null);
      } catch {
        if (!cancelled) setBacklinks(null);
      } finally {
        if (!cancelled) setBacklinksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPath, vaultPath]);

  const saveVault = async () => {
    const p = vaultInput.trim();
    if (!p) return;
    setVaultSaving(true);
    try {
      await api.post("/obsidian/vault", { path: p });
      await loadVault();
      pushToast({ title: "Vault linked", message: "Obsidian vault path saved.", tone: "success" });
    } catch {
      pushToast({ title: "Could not save vault", message: "Check the path exists on the API server.", tone: "error" });
    } finally {
      setVaultSaving(false);
    }
  };

  const selectNote = (path: string) => {
    setSelectedPath(path);
    void loadGraph(searchQuery.trim() || undefined, path);
  };

  const resolveWikiTarget = useCallback(
    (target: string) => {
      const norm = target.trim().toLowerCase();
      const hit =
        files.find((f) => f.name.toLowerCase() === norm) ??
        files.find((f) => f.path.replace(/\.md$/i, "").split("/").pop()?.toLowerCase() === norm) ??
        files.find((f) => f.path.toLowerCase().includes(norm));
      if (hit) selectNote(hit.path);
    },
    [files]
  );

  const searchFileRows = useMemo(
    () =>
      searchQuery.trim()
        ? searchResults.map((f) => ({ name: f.name, path: f.path }))
        : [],
    [searchQuery, searchResults]
  );

  const expandFolderIds = useMemo(() => {
    if (!selectedPath) return [] as string[];
    const parts = selectedPath.split("/");
    parts.pop();
    const ids: string[] = [];
    let pathSoFar = "";
    for (const part of parts) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      ids.push(`folder:${pathSoFar}`);
    }
    return ids;
  }, [selectedPath]);

  if (!vaultPath) {
    return (
      <div className="notes-brain-page">
        <header className="notes-brain-header">
          <h1>Grey Hill Brain</h1>
          <p className="notes-muted">Connect your Obsidian vault to explore the knowledge graph.</p>
        </header>
        <div className="notes-brain-empty">
          <div className="notes-callout">
            <p>No vault configured on this account. Set the folder path where your markdown notes live (must exist on the machine running the Cortex API).</p>
            <p className="notes-muted">Tip: set <code>OBSIDIAN_VAULT_PATH</code> in backend <code>.env</code> to auto-bind Grey Hill Brain for dev/homelab.</p>
          </div>
          <label className="notes-label" htmlFor="vault-path">Vault folder path</label>
          <div className="notes-vault-row">
            <input
              id="vault-path"
              className="notes-vault-input"
              value={vaultInput}
              onChange={(e) => setVaultInput(e.target.value)}
              placeholder="C:\Users\you\Documents\Grey Hill Brain"
            />
            <button type="button" className="btn-primary" disabled={vaultSaving || !vaultInput.trim()} onClick={() => void saveVault()}>
              {vaultSaving ? "Saving…" : "Link vault"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-brain-page">
      <header className="notes-brain-header">
        <div>
          <h1>{vaultName}</h1>
          <p className="notes-brain-sub">
            {graph?.meta.totalNodes ?? 0} notes · {graph?.meta.totalEdges ?? 0} links
            {graph?.meta.limited ? ` (showing ${graph.meta.nodeLimit})` : ""}
            {envHint ? " · env vault" : ""}
          </p>
        </div>
        <div className="notes-brain-header-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => void loadGraph(searchQuery.trim() || undefined, selectedPath ?? undefined)}>
            Refresh graph
          </button>
        </div>
      </header>

      <div className={`notes-brain-layout${showGraph ? "" : " notes-brain-layout--no-graph"}`}>
        <aside className="notes-brain-browse">
          <label className="notes-label" htmlFor="brain-search">
            Search
          </label>
          <input
            id="brain-search"
            className="notes-search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) void loadGraph(e.target.value.trim());
              else void loadGraph(undefined, selectedPath ?? undefined);
            }}
            placeholder="Search notes…"
          />

          {searchQuery.trim() ? (
            <ul className="notes-list notes-brain-search-results">
              {searchFileRows.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    className={`notes-list-item${selectedPath === f.path ? " is-active" : ""}`}
                    onClick={() => selectNote(f.path)}
                  >
                    <span className="notes-list-title">{f.name}</span>
                    <span className="notes-list-excerpt">{f.path}</span>
                  </button>
                </li>
              ))}
              {searchFileRows.length === 0 && <li className="notes-muted">No matches.</li>}
            </ul>
          ) : (
            <VaultBrowser
              files={files}
              selectedPath={selectedPath}
              expandFolderIds={expandFolderIds}
              onSelectNote={selectNote}
            />
          )}
        </aside>

        {showGraph ? (
          <section className="notes-brain-graph-panel" aria-label="Knowledge graph">
            <div className="notes-brain-graph-toolbar">
              <span className="notes-label">Graph</span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowGraph(false)}>
                Hide
              </button>
            </div>
            <div className="notes-brain-graph-wrap">
              {graphLoading && (
                <div className="notes-brain-graph-loading">
                  <span className="inline-loading-spinner" aria-hidden="true" /> Building graph…
                </div>
              )}
              <KnowledgeGraph
                graph={graph}
                focusPath={selectedPath}
                onSelect={(n) => selectNote(n.path)}
              />
            </div>
          </section>
        ) : (
          <div className="notes-brain-graph-collapsed">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShowGraph(true)}>
              Show graph
            </button>
          </div>
        )}

        <main className="notes-brain-reader">
          {!selectedPath && (
            <div className="notes-brain-reader-empty">
              <p className="notes-brain-reader-empty-title">Select a note</p>
              <p className="notes-muted">
                Pick a folder or note on the left, or click a node in the graph. Reading pane uses a
                warmer, paper-style layout for long-form content.
              </p>
            </div>
          )}
          {selectedPath && (
            <>
              <header className="notes-brain-reader-head">
                <div>
                  <p className="notes-brain-reader-breadcrumb">{selectedPath}</p>
                  <h2 className="notes-preview-title">
                    {selectedPath.replace(/\.md$/i, "").split("/").pop()}
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => openExternal(obsidianUri(vaultName, selectedPath))}
                >
                  Open in Obsidian
                </button>
              </header>

              {noteLoading ? (
                <p className="notes-muted notes-brain-reader-loading">Loading note…</p>
              ) : noteContent !== null ? (
                <div className="notes-brain-reader-paper">
                  <DocBody text={noteContent} onWikiLink={resolveWikiTarget} />
                </div>
              ) : null}

              <footer className="notes-brain-reader-links">
                {backlinksLoading && <p className="notes-muted">Loading links…</p>}
                {!backlinksLoading && backlinks ? (
                  <div className="notes-brain-reader-links-grid">
                    <div>
                      <p className="notes-brain-links-heading">Outgoing</p>
                      {backlinks.outgoing.length === 0 ? (
                        <p className="notes-muted">None</p>
                      ) : (
                        <ul className="notes-list notes-brain-links-list">
                          {backlinks.outgoing.map((link) => (
                            <li key={link.path}>
                              <button type="button" className="notes-list-item" onClick={() => selectNote(link.path)}>
                                {link.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="notes-brain-links-heading">Incoming</p>
                      {backlinks.incoming.length === 0 ? (
                        <p className="notes-muted">None</p>
                      ) : (
                        <ul className="notes-list notes-brain-links-list">
                          {backlinks.incoming.map((link) => (
                            <li key={link.path}>
                              <button type="button" className="notes-list-item" onClick={() => selectNote(link.path)}>
                                {link.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
