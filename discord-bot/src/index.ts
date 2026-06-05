import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Interaction,
  Partials,
} from "discord.js";
import { cfg, isAdmin } from "./config.js";
import { containerAction, listContainers } from "./listener.js";
import {
  buildLinksEmbed,
  buildWitnessStatusEmbed,
  formatAdminContainers,
} from "./wpp-status.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[wpp-discord] logged in as ${c.user.tag}`);
  try {
    await c.user.setPresence({
      status: "online",
      activities: [{ name: "Witness Protection Program", type: ActivityType.Watching }],
    });
  } catch {
    /* presence optional */
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== cfg.guildId) return;
  const setupMention = cfg.setupChannelId ? `<#${cfg.setupChannelId}>` : "**#setup**";
  const embed = new EmbedBuilder()
    .setTitle("Welcome to the Witness Protection Program")
    .setColor(0x5865f2)
    .setDescription(
      [
        "You're in the private homelab Discord — movies, files, and photos at home, over **Tailscale** (invite only).",
        "",
        `**Start here:** ${setupMention}`,
        "Read the pinned messages in order: join Tailscale → Connect → open Jellyfin / Nextcloud.",
        "",
        "Commands: `/wpp-links` · `/wpp-status`",
        "Need a login? Ask an admin — never post passwords in chat.",
      ].join("\n"),
    );

  try {
    if (cfg.setupChannelId) {
      const ch = await member.guild.channels.fetch(cfg.setupChannelId);
      if (ch?.isTextBased()) {
        await ch.send({ content: `Welcome <@${member.id}>!`, embeds: [embed] });
        return;
      }
    }
    await member.send({ embeds: [embed] });
  } catch {
    console.warn(`[wpp-discord] could not welcome ${member.user.tag}`);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand() || interaction.guildId !== cfg.guildId) return;

  const adminOnly = ["wpp-containers", "wpp-start", "wpp-stop", "wpp-restart"];
  if (adminOnly.includes(interaction.commandName)) {
    const guildMember = await interaction.guild?.members.fetch(interaction.user.id);
    if (!guildMember || !isAdmin(guildMember)) {
      await interaction.reply({
        content: "Admin only — homelab container control.",
        ephemeral: true,
      });
      return;
    }
  }

  try {
    if (interaction.commandName === "wpp-status") {
      await interaction.deferReply();
      const body = await buildWitnessStatusEmbed();
      const embed = new EmbedBuilder()
        .setTitle(body.title)
        .setDescription(body.description)
        .setFooter({ text: body.footer });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "wpp-links") {
      const body = buildLinksEmbed();
      const embed = new EmbedBuilder().setTitle(body.title).setDescription(body.description);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === "wpp-containers") {
      await interaction.deferReply({ ephemeral: true });
      const list = await listContainers();
      if (!list.ok) {
        await interaction.editReply(`Could not list containers: ${list.error}`);
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("Homelab containers")
        .setDescription(formatAdminContainers(list.containers));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const container = interaction.options.getString("container", true);
    if (interaction.commandName === "wpp-start") {
      await interaction.deferReply({ ephemeral: true });
      const result = await containerAction(container, "start");
      await interaction.editReply(
        result.ok ? `Started \`${container}\`.` : `Failed: ${result.error ?? "unknown"}`,
      );
      return;
    }
    if (interaction.commandName === "wpp-stop") {
      await interaction.deferReply({ ephemeral: true });
      const result = await containerAction(container, "stop");
      await interaction.editReply(
        result.ok ? `Stopped \`${container}\`.` : `Failed: ${result.error ?? "unknown"}`,
      );
      return;
    }
    if (interaction.commandName === "wpp-restart") {
      await interaction.deferReply({ ephemeral: true });
      const result = await containerAction(container, "restart");
      await interaction.editReply(
        result.ok ? `Restarted \`${container}\`.` : `Failed: ${result.error ?? "unknown"}`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Command failed";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

client.login(cfg.token);
