#!/usr/bin/env tsx
/** Check bot token and guild membership — run: npm run wpp:discord:doctor */
import { Client, GatewayIntentBits, Events } from "discord.js";
import { cfg } from "./config.js";

const c = new Client({ intents: [GatewayIntentBits.Guilds] });

c.once(Events.ClientReady, async () => {
  console.log(`Bot: ${c.user?.tag} (${c.user?.id})`);
  console.log(`Configured DISCORD_GUILD_ID: ${cfg.guildId}`);
  console.log("");
  if (c.guilds.cache.size === 0) {
    console.log("❌ This bot is not in ANY Discord server.");
    console.log("");
    console.log("Invite it (replace APPLICATION_ID with yours):");
    console.log(
      `  https://discord.com/oauth2/authorize?client_id=${cfg.clientId}&permissions=84992&scope=bot%20applications.commands`,
    );
    console.log("");
    console.log("After inviting, re-run: npm run wpp:discord:register && npm run wpp:discord");
    await c.destroy();
    process.exit(1);
  }
  console.log("Servers this bot is in:");
  for (const [id, g] of c.guilds.cache) {
    const mark = id === cfg.guildId ? "✓ (matches .env)" : "⚠ different from DISCORD_GUILD_ID";
    console.log(`  - ${g.name}  ${id}  ${mark}`);
  }
  if (!c.guilds.cache.has(cfg.guildId)) {
    console.log("");
    console.log("❌ DISCORD_GUILD_ID in .env does not match any server the bot joined.");
    console.log("   Fix: copy the correct server ID from above into deploy/homelab/.env");
    await c.destroy();
    process.exit(1);
  }
  console.log("");
  console.log("✓ Bot is in the configured server.");
  await c.destroy();
});

c.login(cfg.token);
