import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { api } from "../../../api/client";
import type { Tab } from "../../../tab";
import { useHomelabQuickStatus } from "../../../hooks/useHomelabQuickStatus";

type Props = {
  onNavigate: (tab: Tab) => void;
  compact?: boolean;
};

export function HomelabWidget({ onNavigate, compact }: Props) {
  const { status: homelab, loading: homelabLoading } = useHomelabQuickStatus();
  const [aiLabel, setAiLabel] = useState("…");
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data?: { ollama?: boolean; kimi?: boolean; anthropic?: boolean } }>("/ai/status")
      .then((ai) => {
        if (cancelled) return;
        const aiData = (ai.data?.data ?? ai.data) as {
          ollama?: boolean;
          kimi?: boolean;
          anthropic?: boolean;
        };
        setAiLabel(
          aiData?.ollama ? "Ollama" : aiData?.kimi ? "Kimi" : aiData?.anthropic ? "Claude" : "No AI",
        );
      })
      .catch(() => {
        if (!cancelled) setAiLabel("AI unknown");
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = homelabLoading || aiLoading;

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
      ) : homelab ? (
        <ul className="widget--homelab__stats">
          <li>
            <span>Services</span>
            <strong>
              {homelab.servicesOk}/{homelab.servicesTotal} up
            </strong>
          </li>
          <li>
            <span>Media</span>
            <strong>
              {homelab.mediaOk}/{homelab.mediaTotal} up
            </strong>
          </li>
          {!compact && homelab.cpuPercent != null ? (
            <li>
              <span>CPU</span>
              <strong>{homelab.cpuPercent}%</strong>
            </li>
          ) : null}
          {!compact && homelab.downloadHeadroomHuman ? (
            <li>
              <span>Disk</span>
              <strong>{homelab.downloadHeadroomHuman}</strong>
            </li>
          ) : null}
          <li>
            <span>AI</span>
            <strong>{aiLabel}</strong>
          </li>
        </ul>
      ) : (
        <p className="widget--homelab__muted">Open homelab dashboard</p>
      )}
    </div>
  );
}
