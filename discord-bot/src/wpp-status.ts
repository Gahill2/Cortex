import { execSync } from "node:child_process";
import { cfg } from "./config.js";
import { listContainers, type ContainerRow } from "./listener.js";

type Health = "ok" | "warn" | "down" | "unknown";

const WITNESS_CONTAINERS: Record<string, { label: string; match: (n: string) => boolean }> = {
  jellyfin: { label: "Jellyfin (movies & TV)", match: (n) => n.includes("jellyfin") },
  nextcloud: { label: "Nextcloud (files)", match: (n) => n.includes("nextcloud") && !n.includes("nextcloud-db") },
  immich: { label: "Immich (photos)", match: (n) => n.startsWith("immich_") && n.includes("server") },
};

async function probe(url: string): Promise<Health> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    return res.ok ? "ok" : "warn";
  } catch {
    return "down";
  }
}

function healthFromContainer(c: ContainerRow | undefined): Health {
  if (!c) return "unknown";
  if (c.state !== "running") return "down";
  if (c.health === "ok") return "ok";
  if (c.health === "warn") return "warn";
  return c.state === "running" ? "warn" : "down";
}

function emoji(h: Health): string {
  switch (h) {
    case "ok":
      return "🟢";
    case "warn":
      return "🟡";
    case "down":
      return "🔴";
    default:
      return "⚪";
  }
}

function joeyLibraryOnline(): Health {
  try {
    execSync(`mountpoint -q ${JSON.stringify(cfg.joeyMount)}`, { stdio: "ignore" });
    return "ok";
  } catch {
    return "down";
  }
}

export async function buildWitnessStatusEmbed() {
  const [jellyfinH, nextcloudH, immichH, containers] = await Promise.all([
    probe(cfg.jellyfinHealth),
    probe(cfg.nextcloudHealth),
    probe(cfg.immichHealth),
    listContainers(),
  ]);
  const joeyH = joeyLibraryOnline();

  const byMatch = (fn: (n: string) => boolean) =>
    containers.containers.find((c) => fn(c.name));

  const lines: string[] = [
    `${emoji(jellyfinH)} **Jellyfin** — ${jellyfinH === "ok" ? "online" : jellyfinH}`,
    `${emoji(nextcloudH)} **Nextcloud** — ${nextcloudH === "ok" ? "online" : nextcloudH}`,
    `${emoji(immichH)} **Immich** — ${immichH === "ok" ? "online" : immichH === "down" ? "offline / optional" : immichH}`,
    `${emoji(joeyH)} **Joey's extra movies** — ${joeyH === "ok" ? "library linked" : "Joey's PC offline or unmounted"}`,
  ];

  if (containers.ok) {
    lines.push("", "_Docker (witness apps)_");
    for (const [, meta] of Object.entries(WITNESS_CONTAINERS)) {
      const c = byMatch(meta.match);
      const h = healthFromContainer(c);
      lines.push(`${emoji(h)} ${meta.label}${c ? ` (\`${c.name}\`)` : ""}`);
    }
  } else if (containers.error) {
    lines.push("", `⚠️ Container list unavailable: ${containers.error}`);
  }

  return {
    title: "Witness Protection Program — status",
    description: lines.join("\n"),
    footer: "Tailscale must be connected on your device to use the links.",
  };
}

export function buildLinksEmbed() {
  return {
    title: "WPP — your links",
    description: [
      `🎬 Jellyfin: ${cfg.linkJellyfin}`,
      `📁 Nextcloud: ${cfg.linkNextcloud}`,
      `📷 Immich: ${cfg.linkImmich}`,
      "",
      "Need an account? Ask an admin in chat (do not post passwords).",
      "New here? Complete setup in the setup channel first.",
    ].join("\n"),
  };
}

export function formatAdminContainers(containers: ContainerRow[]): string {
  if (containers.length === 0) return "_No homelab containers found._";
  return containers
    .map((c) => {
      const dot = c.state === "running" ? "🟢" : "🔴";
      return `${dot} \`${c.name}\` — ${c.status}`;
    })
    .join("\n")
    .slice(0, 3900);
}
