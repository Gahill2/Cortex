import { describe, expect, it } from "vitest";
import { basenameNoteId, extractWikilinks, normalizeNoteId } from "../features/obsidian/wikilink-parser.js";

describe("wikilink parser", () => {
  it("extracts plain and aliased wikilinks", () => {
    const md = "See [[Note A]] and [[Folder/Note B|display]] plus [[Other#Heading]].";
    expect(extractWikilinks(md)).toEqual(["Note A", "Folder/Note B", "Other"]);
  });

  it("normalizes note ids case-insensitively without .md", () => {
    expect(normalizeNoteId("Folder/Note.md")).toBe("folder/note");
    expect(basenameNoteId("Folder/Note.md")).toBe("note");
  });
});
