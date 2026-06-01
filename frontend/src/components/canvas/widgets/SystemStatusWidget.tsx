import { useEffect, useState } from "react";
import { api } from "../../../api/client";

type Health = "ok" | "warn" | "unknown";

export function SystemStatusWidget({ compact }: { compact?: boolean }) {
  const [apiHealth, setApiHealth] = useState<Health>("unknown");
  const [latency, setLatency] = useState<number | null>(null);
  const [aiLine, setAiLine] = useState("…");

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    fetch("/api/health", { credentials: "include" })
      .then((r) => {
        if (cancelled) return;
        setLatency(Math.round(performance.now() - t0));
        setApiHealth(r.ok ? "ok" : "warn");
      })
      .catch(() => {
        if (!cancelled) {
          setApiHealth("warn");
          setLatency(null);
        }
      });
    api
      .get("/ai/status")
      .then((r) => {
        if (cancelled) return;
        const d = (r.data?.data ?? r.data) as {
          ollama?: boolean;
          kimi?: boolean;
          anthropic?: boolean;
          ollamaModel?: string;
        };
        if (d?.ollama) setAiLine(`Ollama · ${d.ollamaModel ?? "local"}`);
        else if (d?.kimi) setAiLine("Kimi (cloud)");
        else if (d?.anthropic) setAiLine("Claude (cloud)");
        else setAiLine("No AI");
      })
      .catch(() => {
        if (!cancelled) setAiLine("AI unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    { label: "API", value: apiHealth === "ok" ? "Healthy" : apiHealth === "warn" ? "Check connection" : "…", health: apiHealth },
    { label: "AI", value: aiLine, health: aiLine.includes("Ollama") || aiLine.includes("cloud") ? ("ok" as Health) : ("warn" as Health) },
  ];

  return (
    <div className="widget widget--system" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--system__head">
        <span className="widget--system__dot" data-health={apiHealth} aria-hidden />
        <span>System</span>
      </div>
      <ul className="widget--system__list">
        {rows.slice(0, compact ? 1 : 2).map((r) => (
          <li key={r.label} className="widget--system__row">
            <span>{r.label}</span>
            <span className="widget--system__value" data-health={r.health}>
              {r.value}
            </span>
          </li>
        ))}
      </ul>
      {latency !== null && !compact && (
        <p className="widget--system__foot">{latency}ms round-trip</p>
      )}
    </div>
  );
}
