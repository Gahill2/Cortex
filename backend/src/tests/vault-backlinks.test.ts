import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "node:path";
import os from "node:os";
import { getVaultBacklinks } from "../features/obsidian/vault-backlinks.js";

describe("getVaultBacklinks", () => {
  it("returns incoming and outgoing wikilinks for a note", async () => {
    const vaultPath = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-vault-"));
    await fs.writeFile(path.join(vaultPath, "Hub.md"), "# Hub\n\nSee [[Target]] and [[Other]].\n");
    await fs.writeFile(path.join(vaultPath, "Target.md"), "# Target\n\nLinked from hub.\n");
    await fs.writeFile(path.join(vaultPath, "Other.md"), "Points at [[Target]].\n");

    const hub = await getVaultBacklinks(vaultPath, "Hub.md");
    expect(hub.path).toBe("Hub.md");
    expect(hub.incoming).toEqual([]);
    expect(hub.outgoing.map((o) => o.path).sort()).toEqual(["Other.md", "Target.md"]);

    const target = await getVaultBacklinks(vaultPath, "Target.md");
    expect(target.incoming.map((i) => i.path).sort()).toEqual(["Hub.md", "Other.md"]);
    expect(target.outgoing).toEqual([]);
  });
});
