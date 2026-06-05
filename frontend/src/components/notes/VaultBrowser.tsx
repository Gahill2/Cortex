import { useEffect, useMemo, useState } from "react";
import { buildVaultTree, type VaultFileRow, type VaultTreeNode } from "../../lib/vaultTree";

function FolderIcon() {
  return (
    <svg className="notes-tree-icon notes-tree-icon-folder" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.17a1.5 1.5 0 0 1 1.06.44l1.24 1.24A1.5 1.5 0 0 0 11.03 6H15.5A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z"
      />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="notes-tree-icon notes-tree-icon-note" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 3.5A1.5 1.5 0 0 1 7.5 2h5A1.5 1.5 0 0 1 14 3.5v13a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 16.5v-13Z"
      />
    </svg>
  );
}

function TreeRow(props: {
  node: VaultTreeNode;
  depth: number;
  selectedPath: string | null;
  expanded: Set<string>;
  onToggle: (folderId: string) => void;
  onSelectNote: (path: string) => void;
}) {
  const { node, depth } = props;
  const pad = { paddingLeft: `${8 + depth * 14}px` };

  if (node.kind === "folder") {
    const open = props.expanded.has(node.id);
    const childNotes = (node.children ?? []).filter((c) => c.kind === "note").length;
    const childFolders = (node.children ?? []).filter((c) => c.kind === "folder").length;
    return (
      <li className="notes-tree-folder" role="treeitem" aria-expanded={open}>
        <button
          type="button"
          className="notes-tree-row notes-tree-row-folder"
          style={pad}
          onClick={() => props.onToggle(node.id)}
        >
          <span className={`notes-tree-chevron${open ? " is-open" : ""}`} aria-hidden="true" />
          <FolderIcon />
          <span className="notes-tree-label">{node.name}</span>
          <span className="notes-tree-meta">
            {childFolders > 0 ? `${childFolders} folders` : null}
            {childFolders > 0 && childNotes > 0 ? " · " : null}
            {childNotes > 0 ? `${childNotes} notes` : null}
          </span>
        </button>
        {open && node.children?.length ? (
          <ul className="notes-tree-children" role="group">
            {node.children.map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedPath={props.selectedPath}
                expanded={props.expanded}
                onToggle={props.onToggle}
                onSelectNote={props.onSelectNote}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const active = props.selectedPath === node.path;
  return (
    <li className="notes-tree-note" role="treeitem">
      <button
        type="button"
        className={`notes-tree-row notes-tree-row-note${active ? " is-active" : ""}`}
        style={pad}
        onClick={() => node.path && props.onSelectNote(node.path)}
      >
        <span className="notes-tree-chevron notes-tree-chevron-spacer" aria-hidden="true" />
        <NoteIcon />
        <span className="notes-tree-label">{node.name}</span>
      </button>
    </li>
  );
}

export function VaultBrowser(props: {
  files: VaultFileRow[];
  selectedPath: string | null;
  expandFolderIds?: string[];
  onSelectNote: (path: string) => void;
}) {
  const tree = useMemo(() => buildVaultTree(props.files), [props.files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!props.expandFolderIds?.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of props.expandFolderIds!) next.add(id);
      return next;
    });
  }, [props.expandFolderIds]);

  const toggle = (folderId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const expandAll = () => {
    const ids = new Set<string>();
    const walk = (nodes: VaultTreeNode[]) => {
      for (const n of nodes) {
        if (n.kind === "folder") {
          ids.add(n.id);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(tree);
    setExpanded(ids);
  };

  if (tree.length === 0) {
    return <p className="notes-muted notes-tree-empty">No notes in vault.</p>;
  }

  return (
    <div className="notes-vault-browser">
      <div className="notes-vault-browser-toolbar">
        <span className="notes-label">Vault</span>
        <button type="button" className="btn-ghost btn-sm" onClick={expandAll}>
          Expand all
        </button>
      </div>
      <ul className="notes-tree" role="tree">
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={0}
            selectedPath={props.selectedPath}
            expanded={expanded}
            onToggle={toggle}
            onSelectNote={props.onSelectNote}
          />
        ))}
      </ul>
    </div>
  );
}
