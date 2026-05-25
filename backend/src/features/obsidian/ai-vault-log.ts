import { env } from "../../config/env.js";
import { appendToVault } from "./obsidian-cli.js";
import { resolveVaultPathForUser } from "./vault-store.js";

function formatExchangeSection(input: {
  userMessage: string;
  assistantReply: string;
  provider?: string;
  conversationId?: string;
}): string {
  const ts = new Date().toISOString();
  const providerLine = input.provider ? `\n- Provider: ${input.provider}` : "";
  const convLine = input.conversationId ? `\n- Conversation: ${input.conversationId}` : "";
  return `\n---\n## ${ts}\n${convLine}${providerLine}\n\n**You:** ${input.userMessage.trim()}\n\n**Cortex:** ${input.assistantReply.trim()}\n`;
}

export async function logAiExchange(input: {
  userId: string;
  userMessage: string;
  assistantReply: string;
  provider?: string;
  conversationId?: string;
}): Promise<boolean> {
  if (!env.OBSIDIAN_AI_LOG_ENABLED) return false;

  const vaultPath = await resolveVaultPathForUser(input.userId, { autoBind: true });
  if (!vaultPath) return false;

  const relativePath = env.OBSIDIAN_AI_LOG_PATH || "Cortex/AI Log.md";
  const content = formatExchangeSection(input);

  try {
    await appendToVault({
      vaultPath,
      vaultName: env.OBSIDIAN_VAULT_NAME || undefined,
      relativePath,
      content,
    });
    return true;
  } catch {
    return false;
  }
}
