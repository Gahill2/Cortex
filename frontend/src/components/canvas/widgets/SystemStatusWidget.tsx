import { useEffect, useState } from "react";

type Health = "ok" | "warn" | "unknown";

export function SystemStatusWidget({ compact }: { compact?: boolean }) {
  const [api, setApi] = useState<Health>("unknown");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    fetch("/api/health", { credentials: "include" })
      .then((r) => {
        if (cancelled) return;
        setLatency(Math.round(performance.now() - t0));
        setApi(r.ok ? "ok" : "warn");
      })
      .catch(() => {
        if (!cancelled) {
          setApi("warn");
          setLatency(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    { label: "API", value: api === "ok" ? "Healthy" : api === "warn" ? "Check connection" : "…", health: api },
    { label: "Frontend", value: "Vite dev", health: "ok" as Health },
    { label: "Layout", value: "Local", health: "ok" as Health },
  ];

  return (
    <div className="widget widget--system" onPointerDown={(e) => e.stopPropagation()}>
      <div className="widget--system__head">
        <span className="widget--system__dot" data-health={api} aria-hidden />
        <span>System</span>
      </div>
      <ul className="widget--system__list">
        {rows.slice(0, compact ? 2 : 3).map((r) => (
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
