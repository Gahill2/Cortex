import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";

function relVaultPath(vaultRoot: string, absolutePath: string): string {
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/$/, "");
  const v = norm(vaultRoot);
  const f = norm(absolutePath);
  if (!f.toLowerCase().startsWith(v.toLowerCase())) {
    return absolutePath.split(/[/\\]/).pop() ?? "note.md";
  }
  let out = f.slice(v.length);
  if (out.startsWith("/")) out = out.slice(1);
  return out;
}

function DocBody({ text }: { text: string }) {
  if (!text.trim()) return <p className="notes-doc-empty">Empty page</p>;
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
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="notes-doc-h2">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(
        <h3 key={i} className="notes-doc-h3">
          {line.slice(4)}
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
            <li key={j}>{it}</li>
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
        {para}
      </p>
    );
  }
  return <div className="notes-doc-body">{out}</div>;
}

type Envelope<T> = { ok: boolean; data: T; meta?: unknown };

type NotionResult = { id: string; title: string; url: string | null; last_edited: string };
type ObsidianFile = { name: string; path: string; modified: number; size: number };

type NotionStatus = {
  configured: boolean;
  oauth_configured: boolean;
  internal_token_configured: boolean;
  user_oauth_connected: boolean;
  connected: boolean;
};

type ObsidianRow = { name: string; path: string; excerpt: string };

type ElectronWin = Window & {
  electron?: { isElectron?: boolean; openExternal?: (url: string) => Promise<void> };
};

export const NotesPage = () => {
  const isElectron = !!(window as ElectronWin).electron?.isElectron;
  const openExternal = (url: string) => {
    if (isElectron) void (window as ElectronWin).electron!.openExternal!(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null);
  const [notionLoading, setNotionLoading] = useState(true);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [notionQuery, setNotionQuery] = useState("");
  const [notionResults, setNotionResults] = useState<NotionResult[]>([]);
  const [notionSearchLoading, setNotionSearchLoading] = useState(false);
  const [selectedNotion, setSelectedNotion] = useState<NotionResult | null>(null);
  const [notionBody, setNotionBody] = useState<{ title: string; body: string; url: string | null } | null>(null);
  const [notionPageLoading, setNotionPageLoading] = useState(false);

  const [vaultPath, setVaultPath] = useState("");
  const [vaultInput, setVaultInput] = useState("");
  const [vaultSaving, setVaultSaving] = useState(false);
  const [obsidianFiles, setObsidianFiles] = useState<ObsidianFile[]>([]);
  const [obsidianQuery, setObsidianQuery] = useState("");
  const [obsidianResults, setObsidianResults] = useState<ObsidianRow[]>([]);
  const [selectedObsidianPath, setSelectedObsidianPath] = useState<string | null>(null);
  const [obsidianContent, setObsidianContent] = useState<string | null>(null);
  const [obsidianLoading, setObsidianLoading] = useState(false);

  const [notionView, setNotionView] = useState<"pages" | "databases">("pages");
  const [dbSearch, setDbSearch] = useState("");
  const [databases, setDatabases] = useState<Array<{ id: string; title: string }>>([]);
  const [dbsLoading, setDbsLoading] = useState(false);
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [dbRows, setDbRows] = useState<
    Array<{ id: string; url: string | null; properties: Record<string, string> }>
  >([]);
  const [dbNextCursor, setDbNextCursor] = useState<string | null>(null);
  const [dbTableLoading, setDbTableLoading] = useState(false);
  const [syncRelPath, setSyncRelPath] = useState("Notion/export.md");
  const [syncBusy, setSyncBusy] = useState(false);

  const loadNotionStatus = useCallback(async () => {
    setNotionLoading(true);
    try {
      const r = await api.get<Envelope<NotionStatus>>("/notion/status");
      const s = r.data.data;
      setNotionStatus(s);
      if (s.configured && s.oauth_configured && !s.user_oauth_connected) {
        const u = await api.get<Envelope<{ url?: string }>>("/notion/oauth/url");
        setNotionUrl(u.data.data?.url ?? null);
      } else {
        setNotionUrl(null);
      }
    } catch {
      setNotionStatus(null);
    } finally {
      setNotionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotionStatus();
  }, [loadNotionStatus]);

  useEffect(() => {
    const onOAuth = (e: Event) => {
      const p = (e as CustomEvent<{ provider: string }>).detail?.provider;
      if (p === "notion") void loadNotionStatus();
    };
    window.addEventListener("oauth-connected", onOAuth);
    return () => window.removeEventListener("oauth-connected", onOAuth);
  }, [loadNotionStatus]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get<Envelope<{ path: string | null }>>("/obsidian/vault");
        const p = r.data.data?.path ?? "";
        setVaultPath(p);
        setVaultInput(p);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const refreshObsidianFiles = useCallback(async () => {
    if (!vaultPath) return;
    try {
      const r = await api.get<Envelope<{ files: ObsidianFile[] }>>("/obsidian/files");
      setObsidianFiles(r.data.data?.files ?? []);
    } catch {
      setObsidianFiles([]);
    }
  }, [vaultPath]);

  useEffect(() => {
    void refreshObsidianFiles();
  }, [refreshObsidianFiles]);

  const saveVault = async () => {
    setVaultSaving(true);
    try {
      await api.post("/obsidian/vault", { path: vaultInput.trim() });
      setVaultPath(vaultInput.trim());
      await refreshObsidianFiles();
    } catch {
      /* ignore */
    } finally {
      setVaultSaving(false);
    }
  };

  useEffect(() => {
    if (!notionStatus?.connected) {
      setNotionResults([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setNotionSearchLoading(true);
        try {
          const r = await api.get<Envelope<{ results: NotionResult[] }>>("/notion/search", {
            params: { q: notionQuery },
          });
          setNotionResults(r.data.data?.results ?? []);
        } catch {
          setNotionResults([]);
        } finally {
          setNotionSearchLoading(false);
        }
      })();
    }, 320);
    return () => clearTimeout(t);
  }, [notionQuery, notionStatus?.connected]);

  useEffect(() => {
    if (!selectedNotion?.id || !notionStatus?.connected) {
      setNotionBody(null);
      return;
    }
    void (async () => {
      setNotionPageLoading(true);
      try {
        const r = await api.get<Envelope<{ page: { title: string; body: string; url: string | null } }>>(
          "/notion/page",
          { params: { id: selectedNotion.id } }
        );
        const p = r.data.data?.page;
        if (p) setNotionBody({ title: p.title, body: p.body, url: p.url });
        else setNotionBody(null);
      } catch {
        setNotionBody(null);
      } finally {
        setNotionPageLoading(false);
      }
    })();
  }, [selectedNotion?.id, notionStatus?.connected]);

  useEffect(() => {
    if (notionBody?.title) {
      const slug =
        notionBody.title
          .replace(/[^\w\- ]+/g, "")
          .trim()
          .slice(0, 60)
          .replace(/\s+/g, "-") || "page";
      setSyncRelPath(`Notion/${slug}.md`);
    }
  }, [notionBody?.title]);

  useEffect(() => {
    if (!notionStatus?.connected || notionView !== "databases") return;
    const t = setTimeout(() => {
      void (async () => {
        setDbsLoading(true);
        try {
          const r = await api.get<Envelope<{ databases: Array<{ id: string; title: string }> }>>(
            "/notion/databases",
            { params: { q: dbSearch } }
          );
          setDatabases(r.data.data?.databases ?? []);
        } catch {
          setDatabases([]);
        } finally {
          setDbsLoading(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [dbSearch, notionStatus?.connected, notionView]);

  useEffect(() => {
    if (!selectedDbId || !notionStatus?.connected || notionView !== "databases") {
      setDbRows([]);
      setDbNextCursor(null);
      return;
    }
    void (async () => {
      setDbTableLoading(true);
      try {
        const r = await api.get<
          Envelope<{ rows: Array<{ id: string; url: string | null; properties: Record<string, string> }>; next_cursor: string | null }>
        >("/notion/database/query", { params: { id: selectedDbId } });
        setDbRows(r.data.data?.rows ?? []);
        setDbNextCursor(r.data.data?.next_cursor ?? null);
      } catch {
        setDbRows([]);
        setDbNextCursor(null);
      } finally {
        setDbTableLoading(false);
      }
    })();
  }, [selectedDbId, notionStatus?.connected, notionView]);

  useEffect(() => {
    if (!vaultPath || !obsidianQuery.trim()) {
      setObsidianResults([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await api.get<Envelope<{ results: ObsidianRow[] }>>("/obsidian/search", {
            params: { q: obsidianQuery.trim() },
          });
          setObsidianResults(r.data.data?.results ?? []);
        } catch {
          setObsidianResults([]);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [obsidianQuery, vaultPath]);

  useEffect(() => {
    if (!selectedObsidianPath || !vaultPath) {
      setObsidianContent(null);
      return;
    }
    void (async () => {
      setObsidianLoading(true);
      try {
        const r = await api.get<Envelope<{ content: string }>>("/obsidian/file", {
          params: { path: selectedObsidianPath },
        });
        setObsidianContent(r.data.data?.content ?? "");
      } catch {
        setObsidianContent(null);
      } finally {
        setObsidianLoading(false);
      }
    })();
  }, [selectedObsidianPath, vaultPath]);

  const disconnectNotion = async () => {
    try {
      await api.post("/notion/disconnect");
      await loadNotionStatus();
      setSelectedNotion(null);
      setNotionBody(null);
      setSelectedDbId(null);
      setDbRows([]);
    } catch {
      /* ignore */
    }
  };

  const openNotionOAuth = () => {
    if (!notionUrl) return;
    if (isElectron) void (window as ElectronWin).electron!.openExternal!(notionUrl);
    else window.open(notionUrl, "_blank", "noopener,noreferrer");
  };

  const filteredFiles = useMemo(() => {
    if (!obsidianQuery.trim()) return obsidianFiles.slice(0, 40);
    const q = obsidianQuery.toLowerCase();
    return obsidianFiles.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)).slice(0, 40);
  }, [obsidianFiles, obsidianQuery]);

  const obsidianListRows: ObsidianRow[] = useMemo(() => {
    if (obsidianQuery.trim()) return obsidianResults;
    return filteredFiles.map((f) => ({ name: f.name, path: f.path, excerpt: "" }));
  }, [obsidianQuery, obsidianResults, filteredFiles]);

  const dbColumns = useMemo(() => {
    if (!dbRows.length) return [] as string[];
    const keys = new Set<string>();
    for (const r of dbRows) for (const k of Object.keys(r.properties)) keys.add(k);
    return Array.from(keys).slice(0, 14);
  }, [dbRows]);

  const loadMoreDb = async () => {
    if (!selectedDbId || !dbNextCursor) return;
    setDbTableLoading(true);
    try {
      const r = await api.get<
        Envelope<{ rows: Array<{ id: string; url: string | null; properties: Record<string, string> }>; next_cursor: string | null }>
      >("/notion/database/query", { params: { id: selectedDbId, cursor: dbNextCursor } });
      const next = r.data.data?.rows ?? [];
      setDbRows((p) => [...p, ...next]);
      setDbNextCursor(r.data.data?.next_cursor ?? null);
    } catch {
      /* ignore */
    } finally {
      setDbTableLoading(false);
    }
  };

  const pullToVault = async () => {
    if (!selectedNotion?.id || !syncRelPath.trim()) return;
    setSyncBusy(true);
    try {
      await api.post("/notion/sync/to-obsidian", { pageId: selectedNotion.id, relativePath: syncRelPath.trim() });
      await refreshObsidianFiles();
      window.alert("Saved this Notion page to your vault.");
    } catch {
      window.alert("Could not sync to vault (check path and permissions).");
    } finally {
      setSyncBusy(false);
    }
  };

  const pushToNotion = async () => {
    if (!selectedNotion?.id || !selectedObsidianPath || !vaultPath) return;
    setSyncBusy(true);
    try {
      const rel = relVaultPath(vaultPath, selectedObsidianPath);
      await api.post("/notion/sync/from-obsidian", {
        parentPageId: selectedNotion.id,
        relativePath: rel,
      });
      window.alert("Created a child page in Notion from this note.");
    } catch {
      window.alert("Could not push to Notion (check parent page and integration access).");
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="page notes-page">
      <div className="page-titlebar notes-titlebar">
        <div>
          <h1 className="page-title">Notes</h1>
          <p className="notes-subtitle">
            Notion-style workspace for pages and databases, paired with your local Obsidian vault — pull, push, and
            compare in one place.
          </p>
        </div>
      </div>

      <div className="notes-workbench notes-workbench--shell">
        <div className="notes-notion-app" aria-label="Notion">
          <aside className="notes-ns-sidebar">
            <div className="notes-ns-brand">
              <span className="notes-ns-mark" aria-hidden="true">
                ≡
              </span>
              <div>
                <div className="notes-ns-brand-title">Workspace</div>
                <div className="notes-ns-brand-sub">Notion</div>
              </div>
            </div>

            {notionStatus?.user_oauth_connected && (
              <button
                type="button"
                className="btn-ghost btn-sm notes-ns-disconnect"
                onClick={() => void disconnectNotion()}
              >
                Disconnect OAuth
              </button>
            )}

            {notionStatus?.connected && (
              <>
                <div className="notes-ns-seg" role="tablist" aria-label="Notion area">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={notionView === "pages"}
                    className={notionView === "pages" ? "is-active" : ""}
                    onClick={() => {
                      setNotionView("pages");
                      setSelectedDbId(null);
                    }}
                  >
                    Pages
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={notionView === "databases"}
                    className={notionView === "databases" ? "is-active" : ""}
                    onClick={() => {
                      setNotionView("databases");
                      setSelectedNotion(null);
                      setNotionBody(null);
                    }}
                  >
                    Databases
                  </button>
                </div>

                {notionView === "pages" && (
                  <>
                    <label className="notes-ns-label" htmlFor="notion-search">
                      Search
                    </label>
                    <input
                      id="notion-search"
                      className="form-input notes-ns-input"
                      value={notionQuery}
                      onChange={(e) => setNotionQuery(e.target.value)}
                      placeholder="Filter pages…"
                      autoComplete="off"
                    />
                    <ul className="notes-ns-list" role="listbox" aria-label="Pages">
                      {notionSearchLoading && <li className="notes-muted notes-ns-li">Searching…</li>}
                      {!notionSearchLoading &&
                        notionResults.map((r) => (
                          <li key={r.id} className="notes-ns-li">
                            <button
                              type="button"
                              className={`notes-ns-row ${selectedNotion?.id === r.id ? "is-active" : ""}`}
                              onClick={() => setSelectedNotion(r)}
                            >
                              <span className="notes-ns-row-title">{r.title}</span>
                              <span className="notes-ns-row-meta">
                                {new Date(r.last_edited).toLocaleDateString()}
                              </span>
                            </button>
                          </li>
                        ))}
                      {!notionSearchLoading && notionResults.length === 0 && (
                        <li className="notes-muted notes-ns-li">No pages.</li>
                      )}
                    </ul>
                  </>
                )}

                {notionView === "databases" && (
                  <>
                    <label className="notes-ns-label" htmlFor="db-search">
                      Databases
                    </label>
                    <input
                      id="db-search"
                      className="form-input notes-ns-input"
                      value={dbSearch}
                      onChange={(e) => setDbSearch(e.target.value)}
                      placeholder="Search…"
                      autoComplete="off"
                    />
                    <ul className="notes-ns-list" role="listbox" aria-label="Databases">
                      {dbsLoading && <li className="notes-muted notes-ns-li">Loading…</li>}
                      {!dbsLoading &&
                        databases.map((d) => (
                          <li key={d.id} className="notes-ns-li">
                            <button
                              type="button"
                              className={`notes-ns-row ${selectedDbId === d.id ? "is-active" : ""}`}
                              onClick={() => setSelectedDbId(d.id)}
                            >
                              <span className="notes-ns-row-title">{d.title}</span>
                            </button>
                          </li>
                        ))}
                      {!dbsLoading && databases.length === 0 && (
                        <li className="notes-muted notes-ns-li">No databases found.</li>
                      )}
                    </ul>
                  </>
                )}
              </>
            )}
          </aside>

          <main className="notes-ns-main">
            <div className="notes-ns-scroll">
              {notionLoading && <p className="notes-muted notes-ns-pad">Checking connection…</p>}

              {!notionLoading && notionStatus && !notionStatus.configured && (
                <div className="notes-ns-pad">
                  <div className="notes-callout notes-callout--warn">
                    <p>
                      Add Notion credentials in <strong>.env</strong> (server): either{" "}
                      <code>NOTION_INTERNAL_TOKEN</code> (internal integration secret) or OAuth{" "}
                      <code>NOTION_CLIENT_ID</code>, <code>NOTION_CLIENT_SECRET</code>, and{" "}
                      <code>NOTION_REDIRECT_URI</code>.
                    </p>
                    <p className="notes-muted notes-ntn-note">
                      The <code>ntn</code> CLI from <code>ntn.dev</code> is optional tooling; it does not support Windows.
                      Cortex uses the Notion API directly.
                    </p>
                  </div>
                </div>
              )}

              {!notionLoading && notionStatus?.oauth_configured && !notionStatus.user_oauth_connected && (
                <div className="notes-ns-pad">
                  <div className="notes-callout">
                    <p>Connect your Notion workspace via OAuth (optional if you use NOTION_INTERNAL_TOKEN).</p>
                    <button type="button" className="btn-primary btn-sm" onClick={openNotionOAuth} disabled={!notionUrl}>
                      Connect Notion
                    </button>
                  </div>
                </div>
              )}

              {!notionLoading && notionStatus?.internal_token_configured && !notionStatus.user_oauth_connected && (
                <p className="notes-muted notes-ns-pad">
                  Using server <code>NOTION_INTERNAL_TOKEN</code> — grant that integration access to the pages you want
                  here.
                </p>
              )}

              {notionStatus?.connected && notionView === "pages" && (
                <article className="notes-ns-doc-page">
                  {notionPageLoading && <p className="notes-muted">Loading page…</p>}
                  {!notionPageLoading && notionBody && (
                    <>
                      <header className="notes-ns-doc-head">
                        <h1 className="notes-ns-doc-title">{notionBody.title}</h1>
                        <div className="notes-ns-doc-actions">
                          {notionBody.url && (
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => openExternal(notionBody.url!)}
                            >
                              Open in Notion
                            </button>
                          )}
                          <div className="notes-ns-sync">
                            <input
                              className="form-input notes-ns-sync-input"
                              value={syncRelPath}
                              onChange={(e) => setSyncRelPath(e.target.value)}
                              title="Path inside vault"
                              aria-label="Vault relative path"
                            />
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              disabled={syncBusy || !selectedNotion}
                              onClick={() => void pullToVault()}
                            >
                              Pull → vault
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              disabled={syncBusy || !selectedNotion || !selectedObsidianPath || !vaultPath}
                              onClick={() => void pushToNotion()}
                              title="Create a child page under this Notion page from the selected vault note"
                            >
                              Push note ↑
                            </button>
                          </div>
                        </div>
                      </header>
                      <DocBody text={notionBody.body} />
                    </>
                  )}
                  {!notionPageLoading && !notionBody && selectedNotion && (
                    <p className="notes-muted">Could not load this page.</p>
                  )}
                  {!selectedNotion && <p className="notes-muted notes-ns-empty">Select a page from the sidebar.</p>}
                </article>
              )}

              {notionStatus?.connected && notionView === "databases" && (
                <div className="notes-ns-db-wrap notes-ns-pad">
                  {!selectedDbId && <p className="notes-muted">Choose a database to load rows.</p>}
                  {selectedDbId && (
                    <>
                      {dbTableLoading && dbRows.length === 0 && <p className="notes-muted">Loading rows…</p>}
                      {dbRows.length > 0 && (
                        <div className="notes-ns-table-scroll">
                          <table className="notes-ns-table">
                            <thead>
                              <tr>
                                {dbColumns.map((c) => (
                                  <th key={c}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dbRows.map((row) => (
                                <tr key={row.id}>
                                  {dbColumns.map((c) => (
                                    <td key={c}>{row.properties[c] ?? ""}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {!dbTableLoading && dbRows.length === 0 && <p className="notes-muted">No rows returned.</p>}
                      {dbNextCursor ? (
                        <button
                          type="button"
                          className="btn-ghost btn-sm notes-ns-load-more"
                          disabled={dbTableLoading}
                          onClick={() => void loadMoreDb()}
                        >
                          {dbTableLoading ? "Loading…" : "Load more"}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>

        <div className="notes-notion-app notes-obs-app" aria-label="Obsidian vault">
          <aside className="notes-ns-sidebar notes-ns-sidebar--muted">
            <div className="notes-ns-brand">
              <span className="notes-ns-mark" aria-hidden="true">
                ⌁
              </span>
              <div>
                <div className="notes-ns-brand-title">Vault</div>
                <div className="notes-ns-brand-sub">Obsidian</div>
              </div>
            </div>

            <label className="notes-ns-label" htmlFor="notes-obs-vault-path">
              Path
            </label>
            <div className="notes-ns-vault-row">
              <input
                id="notes-obs-vault-path"
                className="form-input notes-ns-input notes-ns-input--mono"
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="C:\path\to\vault"
              />
              <button type="button" className="btn-primary btn-sm" onClick={() => void saveVault()} disabled={vaultSaving}>
                {vaultSaving ? "…" : "Save"}
              </button>
            </div>

            {!vaultPath && <p className="notes-muted notes-ns-li">Set a vault path.</p>}

            {vaultPath && (
              <>
                <label className="notes-ns-label" htmlFor="notes-obsidian-search">
                  Files
                </label>
                <input
                  id="notes-obsidian-search"
                  className="form-input notes-ns-input"
                  value={obsidianQuery}
                  onChange={(e) => setObsidianQuery(e.target.value)}
                  placeholder="Filter…"
                  autoComplete="off"
                />
                <ul className="notes-ns-list" role="listbox" aria-label="Files">
                  {obsidianListRows.map((f) => (
                    <li key={f.path} className="notes-ns-li">
                      <button
                        type="button"
                        className={`notes-ns-row ${selectedObsidianPath === f.path ? "is-active" : ""}`}
                        onClick={() => setSelectedObsidianPath(f.path)}
                      >
                        <span className="notes-ns-row-title">{f.name}</span>
                        <span className="notes-ns-row-meta">{f.path}</span>
                        {f.excerpt ? <span className="notes-ns-row-excerpt">{f.excerpt}</span> : null}
                      </button>
                    </li>
                  ))}
                  {obsidianListRows.length === 0 && (
                    <li className="notes-muted notes-ns-li">{obsidianQuery.trim() ? "No matches." : "No markdown."}</li>
                  )}
                </ul>
              </>
            )}
          </aside>

          <main className="notes-ns-main notes-ns-main--paper">
            <div className="notes-ns-scroll">
              {!vaultPath && (
                <article className="notes-ns-doc-page">
                  <p className="notes-muted notes-ns-empty">Configure your vault path in the sidebar.</p>
                </article>
              )}
              {vaultPath && (
                <article className="notes-ns-doc-page">
                  {obsidianLoading && <p className="notes-muted">Loading…</p>}
                  {!obsidianLoading && obsidianContent !== null && selectedObsidianPath && (
                    <>
                      <header className="notes-ns-doc-head">
                        <h1 className="notes-ns-doc-title">{selectedObsidianPath.split(/[/\\]/).pop() ?? "Note"}</h1>
                        <p className="notes-ns-doc-path">{selectedObsidianPath}</p>
                      </header>
                      <DocBody text={obsidianContent} />
                    </>
                  )}
                  {!obsidianLoading && obsidianContent === null && selectedObsidianPath && (
                    <p className="notes-muted">Could not read file.</p>
                  )}
                  {!selectedObsidianPath && <p className="notes-muted notes-ns-empty">Select a markdown note.</p>}
                </article>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
