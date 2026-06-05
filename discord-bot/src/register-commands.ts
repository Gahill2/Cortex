import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { cfg } from "./config.js";

const commands = [
  new SlashCommandBuilder()
    .setName("wpp-status")
    .setDescription("Witness Protection Program — are Jellyfin, Nextcloud, etc. running?"),
  new SlashCommandBuilder()
    .setName("wpp-links")
    .setDescription("Your WPP app links (Jellyfin, Nextcloud, Immich)"),
  new SlashCommandBuilder()
    .setName("wpp-containers")
    .setDescription("Admin: list homelab Docker containers")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("wpp-start")
    .setDescription("Admin: start a homelab container")
    .addStringOption((o) =>
      o.setName("container").setDescription("Container name").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("wpp-stop")
    .setDescription("Admin: stop a homelab container")
    .addStringOption((o) =>
      o.setName("container").setDescription("Container name").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("wpp-restart")
    .setDescription("Admin: restart a homelab container")
    .addStringOption((o) =>
      o.setName("container").setDescription("Container name").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(cfg.token);

await rest.put(Routes.applicationGuildCommands(cfg.clientId, cfg.guildId), {
  body: commands,
});

console.log(`Registered ${commands.length} guild commands on ${cfg.guildId}`);
