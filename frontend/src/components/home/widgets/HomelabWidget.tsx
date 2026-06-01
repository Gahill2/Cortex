import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { api } from "../../../api/client";
import type { Tab } from "../../../tab";

type Props = {
  onNavigate: (tab: Tab) => void;
  compact?: boolean;
};

type QuickStatus = {
  servicesOk: number;
  servicesTotal: number;
  cpu: number | null;
  aiLabel: string;
};

export function HomelabWidget({ onNavigate, compact }: Props) {
  const [status, setStatus] = useState<QuickStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ data?: { services?: { health: string }[]; metrics?: { cpuPercent: number | null } } }>(
        "/homelab/status",
      ),
      api.get<{ data?: { ollama?: boolean; kimi?: boolean; anthropic?: boolean; defaultProvider?: string } }>(
        "/ai/status",
      ),
    ])
      .then(([homelab, ai]) => {
        if (cancelled) return;
        const services = homelab.data?.data?.services ?? [];
        const ok = services.filter((s) => s.health === "ok").length;
        const aiData = (ai.data?.data ?? ai.data) as {
          ollama?: boolean;
          kimi?: boolean;
          anthropic?: boolean;
        };
        const aiLabel = aiData?.ollama
          ? "Ollama"
          : aiData?.kimi
            ? "Kimi"
            : aiData?.anthropic
              ? "Claude"
              : "No AI";
        setStatus({
          servicesOk: ok,
          servicesTotal: services.length,
          cpu: homelab.data?.data?.metrics?.cpuPercent ?? null,
          aiLabel,
        });
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="widget widget--homelab"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate("homelab")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate("homelab");
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="widget--homelab__head">
        <Server size={16} aria-hidden />
        <span>Homelab</span>
      </div>
      {loading ? (
        <p className="widget--homelab__muted">Checking…</p>
      ) : status ? (
        <ul className="widget--homelab__stats">
          <li>
            <span>Services</span>
            <strong>
              {status.servicesOk}/{status.servicesTotal} up
            </strong>
          </li>
          {!compact && status.cpu != null ? (
            <li>
              <span>CPU</span>
              <strong>{status.cpu}%</strong>
            </li>
          ) : null}
          <li>
            <span>AI</span>
            <strong>{status.aiLabel}</strong>
          </li>
        </ul>
      ) : (
        <p className="widget--homelab__muted">Open homelab dashboard</p>
      )}
    </div>
  );
}
