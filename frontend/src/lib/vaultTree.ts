export type VaultTreeNode = {
  id: string;
  name: string;
  kind: "folder" | "note";
  path?: string;
  children?: VaultTreeNode[];
};

export type VaultFileRow = { name: string; path: string };

/** Build a folder/note tree from flat vault file paths (e.g. `Projects/AI/foo.md`). */
export function buildVaultTree(files: VaultFileRow[]): VaultTreeNode[] {
  const root: VaultTreeNode[] = [];
  const folderMap = new Map<string, VaultTreeNode>();

  const ensureFolder = (parts: string[], parentChildren: VaultTreeNode[]) => {
    let children = parentChildren;
    let pathSoFar = "";
    for (const part of parts) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      let folder = folderMap.get(pathSoFar);
      if (!folder) {
        folder = { id: `folder:${pathSoFar}`, name: part, kind: "folder", children: [] };
        folderMap.set(pathSoFar, folder);
        children.push(folder);
      }
      children = folder.children!;
    }
    return children;
  };

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));

  for (const file of sorted) {
    const segments = file.path.split("/");
    const fileName = segments.pop() ?? file.name;
    const note: VaultTreeNode = {
      id: `note:${file.path}`,
      name: fileName,
      kind: "note",
      path: file.path,
    };
    if (segments.length === 0) {
      root.push(note);
    } else {
      const parent = ensureFolder(segments, root);
      parent.push(note);
    }
  }

  const sortNodes = (nodes: VaultTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const n of nodes) {
      if (n.children?.length) sortNodes(n.children);
    }
  };
  sortNodes(root);
  return root;
}

export function collectFolderPaths(nodes: VaultTreeNode[], prefix = ""): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind !== "folder") continue;
    const p = prefix ? `${prefix}/${n.name}` : n.name;
    out.push(p);
    if (n.children?.length) out.push(...collectFolderPaths(n.children, p));
  }
  return out;
}
