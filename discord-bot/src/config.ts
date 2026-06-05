import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const homelabEnv = join(root, "..", "deploy", "homelab", ".env");
// Prefer deploy/homelab/.env (where you added DISCORD_*); discord-bot/.env overrides if present.
config({ path: homelabEnv });
config({ path: join(root, ".env"), override: true });
if (!process.env.CORTEX_DEPLOY_TOKEN?.trim()) {
  config({ path: join(root, "..", ".env") });
}

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name} (see discord-bot/.env.example)`);
  return v;
}

function ids(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export const cfg = {
  token: req("DISCORD_BOT_TOKEN"),
  clientId: req("DISCORD_APPLICATION_ID"),
  guildId: req("DISCORD_GUILD_ID"),
  setupChannelId: process.env.DISCORD_SETUP_CHANNEL_ID?.trim() ?? "",
  adminRoleIds: ids(process.env.DISCORD_ADMIN_ROLE_IDS),
  adminUserIds: ids(process.env.DISCORD_ADMIN_USER_IDS),
  listenerUrl: (process.env.HOMELAB_DEPLOY_LISTENER_URL ?? "http://127.0.0.1:9092").replace(/\/$/, ""),
  deployToken: process.env.CORTEX_DEPLOY_TOKEN?.trim() ?? "",
  jellyfinHealth: process.env.WPP_JELLYFIN_HEALTH_URL ?? "http://127.0.0.1:8096/health",
  nextcloudHealth: process.env.WPP_NEXTCLOUD_HEALTH_URL ?? "http://127.0.0.1:8081/status.php",
  immichHealth: process.env.WPP_IMMICH_HEALTH_URL ?? "http://127.0.0.1:2283/api/server/ping",
  linkJellyfin: process.env.WPP_LINK_JELLYFIN ?? "http://jellyfin.cortex:8096",
  linkNextcloud: process.env.WPP_LINK_NEXTCLOUD ?? "http://cloud.cortex:8081",
  linkImmich: process.env.WPP_LINK_IMMICH ?? "http://photos.cortex:2283",
  joeyMount: process.env.WPP_JOEY_MOUNT ?? "/mnt/cortex/jellyfin-remote",
};

export function isAdmin(member: {
  id: string;
  roles: { cache: { has: (id: string) => boolean } };
}): boolean {
  if (cfg.adminUserIds.has(member.id)) return true;
  if (cfg.adminRoleIds.size === 0) return false;
  return [...cfg.adminRoleIds].some((rid) => member.roles.cache.has(rid));
}
