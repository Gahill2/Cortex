import { useCallback, useEffect, useMemo, useState } from "react";

const LS_IP = "cortex_mcp_tailscale_ip";
const LS_PORT = "cortex_mcp_port";
const LS_LABEL = "cortex_mcp_label";
const LS_NOTES = "cortex_mcp_notes";

const TOOLS = [
  { name: "get_cortex_status", desc: "App + MCP status (read-only)." },
  { name: "create_task_note", desc: "Append a note to local JSON on the PC (not Prisma tasks)." },
  { name: "recommend_music_seed", desc: "Mock playlist ideas (no Spotify)." },
  { name: "draft_email_template", desc: "Draft text only — never sends mail." },
  { name: "list_available_cortex_tools", desc: "Tool catalog." },
];

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt("Copy:", text);
  }
}

export const McpLinkPage = ({ embedded = false }: { embedded?: boolean }) => {
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [port, setPort] = useState("3001");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [localHealth, setLocalHealth] = useState<"idle" | "ok" | "err">("idle");
  const [tsHealth, setTsHealth] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    setTailscaleIp(localStorage.getItem(LS_IP) ?? "");
    setPort(localStorage.getItem(LS_PORT) ?? "3001");
    setLabel(localStorage.getItem(LS_LABEL) ?? "");
    setNotes(localStorage.getItem(LS_NOTES) ?? "");
  }, []);

  const persist = useCallback(() => {
    localStorage.setItem(LS_IP, tailscaleIp.trim());
    localStorage.setItem(LS_PORT, port.trim() || "3001");
    localStorage.setItem(LS_LABEL, label);
    localStorage.setItem(LS_NOTES, notes);
  }, [tailscaleIp, port, label, notes]);

  useEffect(() => {
    const t = setTimeout(persist, 300);
    return () => clearTimeout(t);
  }, [persist]);

  const localBase = useMemo(() => `http://127.0.0.1:${port.trim() || "3001"}`, [port]);
  const tsBase = useMemo(() => {
    const ip = tailscaleIp.trim();
    if (!ip) return "";
    return `http://${ip}:${port.trim() || "3001"}`;
  }, [tailscaleIp, port]);

  const probeLocal = useCallback(async () => {
    setLocalHealth("idle");
    try {
      const r = await fetch(`${localBase}/health`, { method: "GET" });
      setLocalHealth(r.ok ? "ok" : "err");
    } catch {
      setLocalHealth("err");
    }
  }, [localBase]);

  const probeTs = useCallback(async () => {
    if (!tsBase) {
      setTsHealth("idle");
      return;
    }
    setTsHealth("idle");
    try {
      const r = await fetch(`${tsBase}/health`, { method: "GET" });
      setTsHealth(r.ok ? "ok" : "err");
    } catch {
      setTsHealth("err");
    }
  }, [tsBase]);

  useEffect(() => {
    void probeLocal();
  }, [probeLocal]);

  useEffect(() => {
    void probeTs();
  }, [probeTs]);

  return (
    <div className={`mcp-link-page${embedded ? " mcp-link-page--embedded" : " page"}`}>
      {!embedded && (
        <div className="page-titlebar">
          <div>
            <p className="page-eyebrow">Automation</p>
            <h1 className="page-title">Cortex Link (MCP)</h1>
          </div>
          <div className="page-actions">
            <button type="button" className="btn-ghost btn-sm" onClick={() => void probeLocal()}>
              Ping local MCP
            </button>
            {tsBase && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => void probeTs()}>
                Ping Tailscale MCP
              </button>
            )}
          </div>
        </div>
      )}
      {embedded && (
        <div className="settings-embedded-actions">
          <p className="settings-section-desc">
            MCP runs separately from the main API. Use Tailscale only — no public port forwarding.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => void probeLocal()}>
              Ping local MCP
            </button>
            {tsBase && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => void probeTs()}>
                Ping Tailscale MCP
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mcp-link-grid">
        <section className="mcp-link-card">
          <h2 className="mcp-link-card-title">Connection</h2>
          <p className="mcp-link-muted">
            MCP runs in a <strong>separate</strong> process from the main API (port 4000). Use Tailscale only — no
            public port forwarding.
          </p>
          <div className="mcp-link-field">
            <label>Label</label>
            <input
              className="mcp-link-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main PC"
            />
          </div>
          <div className="mcp-link-field">
            <label>PC Tailscale IPv4</label>
            <input
              className="mcp-link-input"
              value={tailscaleIp}
              onChange={(e) => setTailscaleIp(e.target.value)}
              placeholder="100.x.x.x (run tailscale ip -4 on the PC)"
            />
          </div>
          <div className="mcp-link-field">
            <label>MCP port</label>
            <input
              className="mcp-link-input"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="3001"
            />
          </div>
          <div className="mcp-link-field">
            <label>Notes</label>
            <textarea
              className="mcp-link-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional reminders (stored in this browser only)"
              rows={3}
            />
          </div>
        </section>

        <section className="mcp-link-card">
          <h2 className="mcp-link-card-title">Endpoints</h2>
          <div className="mcp-link-endpoint">
            <div className="mcp-link-endpoint-head">
              <span>Local (this machine)</span>
              <span className={`mcp-link-pill mcp-link-pill--${localHealth}`}>{localHealth}</span>
            </div>
            <code className="mcp-link-code">{localBase}</code>
            <div className="mcp-link-actions">
              <button type="button" className="btn-ghost btn-sm" onClick={() => void copyText(localBase)}>
                Copy base URL
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => void copyText(`${localBase}/mcp`)}>
                Copy MCP path
              </button>
            </div>
          </div>
          <div className="mcp-link-endpoint">
            <div className="mcp-link-endpoint-head">
              <span>Tailscale (phone / other device)</span>
              <span className={`mcp-link-pill mcp-link-pill--${tsBase ? tsHealth : "idle"}`}>
                {!tsBase ? "set IP" : tsHealth}
              </span>
            </div>
            {tsBase ? (
              <>
                <code className="mcp-link-code">{tsBase}</code>
                <div className="mcp-link-actions">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => void copyText(tsBase)}>
                    Copy base URL
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => void copyText(`${tsBase}/mcp`)}>
                    Copy MCP path
                  </button>
                </div>
              </>
            ) : (
              <p className="mcp-link-muted">Enter your PC Tailscale IP above (same tailnet as this phone).</p>
            )}
          </div>
          <p className="mcp-link-muted mcp-link-small">
            In <code className="mcp-link-inline">backend/.env</code> use{" "}
            <code className="mcp-link-inline">CORTEX_MCP_MODE=tailscale</code> and{" "}
            <code className="mcp-link-inline">CORTEX_MCP_HOST=0.0.0.0</code>, then{" "}
            <code className="mcp-link-inline">npm run mcp:dev</code> from the backend folder. Streamable HTTP POST goes
            to <code className="mcp-link-inline">/mcp</code>.
          </p>
        </section>

        <section className="mcp-link-card mcp-link-card--wide">
          <h2 className="mcp-link-card-title">Starter tools</h2>
          <ul className="mcp-link-tool-list">
            {TOOLS.map((t) => (
              <li key={t.name}>
                <code className="mcp-link-inline">{t.name}</code> — {t.desc}
              </li>
            ))}
          </ul>
        </section>

        <section className="mcp-link-card mcp-link-card--wide">
          <h2 className="mcp-link-card-title">Tailscale checklist</h2>
          <ol className="mcp-link-ol">
            <li>Install Tailscale on this PC and on your phone; sign into the <strong>same</strong> account or shared tailnet.</li>
            <li>On the PC, run <code className="mcp-link-inline">tailscale ip -4</code> and paste the address above.</li>
            <li>Start MCP with <code className="mcp-link-inline">CORTEX_MCP_MODE=tailscale</code> so it listens on all interfaces.</li>
            <li>From the phone, your MCP client should target <code className="mcp-link-inline">http://&lt;PC-100.x&gt;:&lt;port&gt;/mcp</code>.</li>
            <li>Keep Windows Firewall in mind — allow Node for private networks if health check fails.</li>
          </ol>
        </section>

        <section className="mcp-link-card mcp-link-card--wide mcp-link-card--warn">
          <h2 className="mcp-link-card-title">Safety</h2>
          <ul className="mcp-link-ul">
            <li>Do not port-forward this port on your home router.</li>
            <li>Do not expose MCP to the public internet.</li>
            <li>Use sample data while testing; starter tools do not send email or call Spotify.</li>
            <li>Anyone in your tailnet who can reach the PC IP could call tools — keep Tailscale ACLs tight if you use shared networks.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
