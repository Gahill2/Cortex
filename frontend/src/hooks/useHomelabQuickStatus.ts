import { useEffect, useState } from "react";
import { api } from "../api/client";

export type HomelabServiceHealth = "ok" | "warn" | "down" | "unknown" | "skipped";

export interface HomelabQuickService {
  id: string;
  name: string;
  category: string;
  health: HomelabServiceHealth;
}

export interface HomelabQuickStatus {
  services: HomelabQuickService[];
  servicesOk: number;
  servicesTotal: number;
  cpuPercent: number | null;
  downloadHeadroomHuman: string | null;
  mediaServices: HomelabQuickService[];
  mediaOk: number;
  mediaTotal: number;
}

const MEDIA_SERVICE_IDS = new Set([
  "jellyfin",
  "radarr",
  "sonarr",
  "prowlarr",
  "qbittorrent",
  "sabnzbd",
  "immich",
]);

const CACHE_TTL_MS = 45_000;
let statusCache: { at: number; data: HomelabQuickStatus } | null = null;
let inflight: Promise<HomelabQuickStatus | null> | null = null;

async function fetchHomelabQuickStatus(): Promise<HomelabQuickStatus | null> {
  if (statusCache && Date.now() - statusCache.at < CACHE_TTL_MS) {
    return statusCache.data;
  }
  if (inflight) return inflight;

  inflight = api
    .get<{
      data?: {
        services?: HomelabQuickService[];
        metrics?: { cpuPercent: number | null };
        storage?: { downloadHeadroomHuman: string | null };
      };
    }>("/homelab/quick")
    .then((res) => {
      const payload = (res.data?.data ?? res.data) as {
        services?: HomelabQuickService[];
        metrics?: { cpuPercent: number | null };
        storage?: { downloadHeadroomHuman: string | null };
      };
      const services = payload?.services ?? [];
      const ok = services.filter((s) => s.health === "ok").length;
      const mediaServices = services.filter((s) => MEDIA_SERVICE_IDS.has(s.id));
      const mediaOk = mediaServices.filter((s) => s.health === "ok").length;
      const data: HomelabQuickStatus = {
        services,
        servicesOk: ok,
        servicesTotal: services.length,
        cpuPercent: payload?.metrics?.cpuPercent ?? null,
        downloadHeadroomHuman: payload?.storage?.downloadHeadroomHuman ?? null,
        mediaServices,
        mediaOk,
        mediaTotal: mediaServices.length,
      };
      statusCache = { at: Date.now(), data };
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Shared homelab snapshot for dashboard widgets (cached ~45s). */
export function useHomelabQuickStatus() {
  const [status, setStatus] = useState<HomelabQuickStatus | null>(
    () => statusCache?.data ?? null,
  );
  const [loading, setLoading] = useState(!statusCache);

  useEffect(() => {
    let cancelled = false;
    if (statusCache && Date.now() - statusCache.at < CACHE_TTL_MS) {
      setStatus(statusCache.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchHomelabQuickStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
