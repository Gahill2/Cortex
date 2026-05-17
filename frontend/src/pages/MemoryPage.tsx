import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

type MemoryStatus = {
  agentmemory: { ok: boolean; url: string; detail?: string };
  agentmemoryUrl: string;
  viewerUrl: string | null;
  project: string;
  obsidianVaults: Array<{ path: string; name: string }>;
  vaultIndex?: { entryCount: number; configured: boolean };
  mcpConfig: { command: string; args: string[]; env: Record<string, string> };
};

type SearchHit = {
  id: string;
  source: string;
  title: string;
  snippet: string;
  path?: string;
  vault?: string;
};

export const MemoryPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [query, setQuery] = useState("");
  const [agentHits, setAgentHits] = useState<SearchHit[]>([]);
  const [obsidianHits, setObsidianHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [vaultEntryCount, setVaultEntryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: MemoryStatus }>("/memory/status");
      const data = res.data?.data ?? null;
      setStatus(data);
      setVaultEntryCount(data?.vaultIndex?.entryCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load memory status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const res = await api.post<{
        data?: { agentmemory?: SearchHit[]; obsidian?: SearchHit[] };
      }>("/memory/search", { q, limit: 16 });
      setAgentHits(res.data?.data?.agentmemory ?? []);
      setObsidianHits(res.data?.data?.obsidian ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const mcpJson = status
    ? JSON.stringify(
        {
          mcpServers: {
            agentmemory: {
              command: status.mcpConfig.command,
              args: status.mcpConfig.args,
              env: status.mcpConfig.env
            }
          }
        },
        null,
        2
      )
    : "";

  const handleReindex = async () => {
    setReindexing(true);
    setError(null);
    try {
      const res = await api.get<{ data?: { entryCount?: number } }>("/memory/vaults/reindex");
      setVaultEntryCount(res.data?.data?.entryCount ?? 0);
      if (query.trim().length >= 2) await runSearch();
    } catch {
      setError("Reindex failed.");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className={`memory-page${embedded ? " memory-page--embedded" : " page"}`}>
      {!embedded ? (
      <div className="page-titlebar">
        <div>
          <h1 className="page-title">Memory</h1>
          <p className="page-subtitle">
            Unified search across{" "}
            <a href="https://github.com/rohitg00/agentmemory" target="_blank" rel="noreferrer">
              agentmemory
            </a>{" "}
            and Obsidian — use the same project name on every machine.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn-ghost btn-sm" disabled={reindexing} onClick={() => void handleReindex()}>
            {reindexing ? "Reindexing…" : "Reindex vaults"}
          </button>
        </div>
      </div>
      ) : (
        <div className="settings-embedded-actions">
          <p className="settings-section-desc">
            Unified search across agentmemory and Obsidian — use the same project name on every machine.
          </p>
          <button type="button" className="btn-ghost btn-sm" disabled={reindexing} onClick={() => void handleReindex()}>
            {reindexing ? "Reindexing…" : "Reindex vaults"}
          </button>
        </div>
      )}

      {loading && <p className="muted">Loading memory services…</p>}
      {error && <p className="error-text">{error}</p>}

      {status && (
        <div className="memory-status-grid">
          <div className="card">
            <h3>Agentmemory</h3>
            <p>
              <span className={status.agentmemory.ok ? "status-ok" : "status-warn"}>
                {status.agentmemory.ok ? "Running" : "Offline"}
              </span>
              {" · "}
              <code>{status.agentmemoryUrl}</code>
            </p>
            {!status.agentmemory.ok && status.agentmemory.detail && (
              <p className="muted">{status.agentmemory.detail}</p>
            )}
            <p className="muted">
              Start: <code>npm run dev:memory</code> (API :3111, viewer :3113)
            </p>
            {status.viewerUrl && (
              <p>
                <a href={status.viewerUrl} target="_blank" rel="noreferrer">
                  Open memory viewer
                </a>
              </p>
            )}
          </div>

          <div className="card">
            <h3>Obsidian vaults</h3>
            {status.obsidianVaults.length === 0 ? (
              <p className="muted">
                Set <code>OBSIDIAN_VAULT_PATHS</code> in backend <code>.env</code>.
              </p>
            ) : (
              <ul className="memory-vault-list">
                {status.obsidianVaults.map((v) => (
                  <li key={v.path}>
                    <strong>{v.name}</strong>
                    <br />
                    <code className="muted">{v.path}</code>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">
              Project: <code>{status.project}</code>
              {vaultEntryCount > 0 && <> · {vaultEntryCount} notes indexed</>}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void runSearch(e)} className="memory-search-form">
        <input
          type="search"
          placeholder="Search agent memory and vault notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
        />
        <button type="submit" className="btn-primary btn-sm" disabled={searching || query.trim().length < 2}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {(agentHits.length > 0 || obsidianHits.length > 0) && (
        <div className="memory-results">
          {agentHits.length > 0 && (
            <section>
              <h2 className="section-title">Agent memory</h2>
              <ul className="memory-hit-list">
                {agentHits.map((h) => (
                  <li key={h.id} className="card memory-hit">
                    <strong>{h.title}</strong>
                    <p className="muted">{h.snippet}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {obsidianHits.length > 0 && (
            <section>
              <h2 className="section-title">Obsidian</h2>
              <ul className="memory-hit-list">
                {obsidianHits.map((h) => (
                  <li key={h.id} className="card memory-hit">
                    <strong>{h.title}</strong>
                    {h.vault && <span className="badge">{h.vault}</span>}
                    <p className="muted">{h.snippet}</p>
                    {h.path && <code className="memory-path">{h.path}</code>}
                    {"obsidianUri" in h && typeof (h as { obsidianUri?: string }).obsidianUri === "string" && (
                      <a className="btn-ghost btn-sm" href={(h as { obsidianUri: string }).obsidianUri}>
                        Open in Obsidian
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {status && (
        <section className="card memory-mcp-card">
          <h3>Cursor / Claude MCP</h3>
          <p className="muted">Paste into MCP config so agents share this memory store.</p>
          <pre className="code-block">{mcpJson}</pre>
        </section>
      )}
    </div>
  );
};
