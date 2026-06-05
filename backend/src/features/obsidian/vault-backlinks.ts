import { basenameNoteId, extractWikilinks, normalizeNoteId } from "./wikilink-parser.js";
import { resolveLinkTarget, walkMarkdown, type VaultNoteRecord } from "./vault-graph.js";

export interface BacklinkRef {
  path: string;
  label: string;
}

export interface VaultBacklinks {
  path: string;
  incoming: BacklinkRef[];
  outgoing: BacklinkRef[];
}

function buildNoteIndex(notes: VaultNoteRecord[]) {
  const byId = new Map<string, VaultNoteRecord>();
  const byBasename = new Map<string, VaultNoteRecord>();
  for (const note of notes) {
    byId.set(note.id, note);
    const base = basenameNoteId(note.path);
    if (!byBasename.has(base)) byBasename.set(base, note);
  }
  return { byId, byBasename };
}

export async function getVaultBacklinks(vaultPath: string, relPath: string): Promise<VaultBacklinks> {
  const notes = await walkMarkdown(vaultPath);
  const { byId, byBasename } = buildNoteIndex(notes);

  const selected =
    byId.get(normalizeNoteId(relPath)) ?? byBasename.get(basenameNoteId(relPath));
  if (!selected) {
    return { path: relPath.replace(/\\/g, "/"), incoming: [], outgoing: [] };
  }

  const incoming: BacklinkRef[] = [];
  const outgoing: BacklinkRef[] = [];
  const outgoingIds = new Set<string>();
  const incomingPaths = new Set<string>();

  for (const note of notes) {
    if (note.id === selected.id) continue;
    const links = extractWikilinks(note.content);
    for (const link of links) {
      const targetId = resolveLinkTarget(link, byId, byBasename);
      if (targetId !== selected.id) continue;
      if (incomingPaths.has(note.path)) break;
      incomingPaths.add(note.path);
      incoming.push({ path: note.path, label: note.label });
      break;
    }
  }

  const links = extractWikilinks(selected.content);
  for (const link of links) {
    const targetId = resolveLinkTarget(link, byId, byBasename);
    if (!targetId || targetId === selected.id || outgoingIds.has(targetId)) continue;
    const target = byId.get(targetId);
    if (!target) continue;
    outgoingIds.add(targetId);
    outgoing.push({ path: target.path, label: target.label });
  }

  const byLabel = (a: BacklinkRef, b: BacklinkRef) => a.label.localeCompare(b.label);
  incoming.sort(byLabel);
  outgoing.sort(byLabel);

  return { path: selected.path, incoming, outgoing };
}
