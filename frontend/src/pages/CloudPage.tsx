import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  Grid3x3,
  LayoutList,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "../api/client";
import { openExternalUrl } from "../utils/openExternalUrl";
import { EmptyState } from "../components/ui/EmptyState";
import { useToastStore } from "../stores/toastStore";

interface CloudFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string | null;
}

interface CloudQuota {
  used: number;
  free: number;
  total: number;
  usedPercent: number | null;
  usedHuman: string;
  totalHuman: string;
}

interface CloudStatusPayload {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  username: string;
  quota: CloudQuota | null;
  openUrl?: string;
  message?: string;
}

type ViewMode = "list" | "grid";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function formatDateRelative(raw: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fileIcon(entry: CloudFileEntry) {
  if (entry.isDirectory) return Folder;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(ext)) return FileImage;
  if (["mp4", "mkv", "mov", "avi", "webm"].includes(ext)) return FileVideo;
  if (["pdf", "doc", "docx", "txt", "md", "rtf"].includes(ext)) return FileText;
  return File;
}

export function CloudPage() {
  const pushToast = useToastStore((s) => s.push);
  const [status, setStatus] = useState<CloudStatusPayload | null>(null);
  const [path, setPath] = useState("");
  const [files, setFiles] = useState<CloudFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get<{ data?: CloudStatusPayload }>("/cloud/status");
      setStatus(r.data?.data ?? null);
      return r.data?.data ?? null;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  const loadFiles = useCallback(async (dir: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data?: { path: string; files: CloudFileEntry[] } }>("/cloud/list", {
        params: { path: dir },
      });
      setFiles(r.data?.data?.files ?? []);
      setPath(r.data?.data?.path ?? dir);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Could not load files";
      setError(msg);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadStatus();
    await loadFiles(path);
  }, [loadFiles, loadStatus, path]);

  useEffect(() => {
    void (async () => {
      const st = await loadStatus();
      if (st?.connected) {
        await loadFiles("");
      } else {
        setLoading(false);
      }
    })();
  }, [loadFiles, loadStatus]);

  const crumbs = path ? path.split("/") : [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [filtered]);

  const navigateTo = (target: string) => {
    setSearch("");
    setMenuPath(null);
    void loadFiles(target);
  };

  const openFolder = (entry: CloudFileEntry) => {
    if (entry.isDirectory) navigateTo(entry.path);
  };

  const downloadFile = async (entry: CloudFileEntry) => {
    try {
      const r = await api.get("/cloud/download", {
        params: { path: entry.path },
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast({ title: "Download failed", tone: "error" });
    }
  };

  const deleteEntry = async (entry: CloudFileEntry) => {
    if (!window.confirm(`Move "${entry.name}" to trash?`)) return;
    try {
      await api.delete("/cloud/files", { params: { path: entry.path } });
      pushToast({ title: "Deleted", tone: "success" });
      setMenuPath(null);
      await loadFiles(path);
      await loadStatus();
    } catch {
      pushToast({ title: "Delete failed", tone: "error" });
    }
  };

  const onUploadPick = () => fileInputRef.current?.click();

  const onUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.post(`/cloud/upload?path=${encodeURIComponent(path)}&name=${encodeURIComponent(file.name)}`, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      pushToast({ title: `Uploaded ${file.name}`, tone: "success" });
      await loadFiles(path);
      await loadStatus();
    } catch {
      pushToast({ title: "Upload failed", tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const openNextcloud = () => {
    const url = status?.openUrl || status?.baseUrl;
    if (url) openExternalUrl(url);
  };

  const notReady = status && !status.connected;
  const folderLabel = crumbs.length ? crumbs[crumbs.length - 1] : "My Drive";

  return (
    <div className="page cloud-page cloud-page--drive">
      <div className="cloud-drive">
        <aside className="cloud-drive__sidebar" aria-label="Cloud navigation">
          <div className="cloud-drive__brand">
            <Cloud size={22} aria-hidden />
            <span>Drive</span>
          </div>
          <button type="button" className="cloud-drive__new" onClick={onUploadPick} disabled={!status?.connected || uploading}>
            <Plus size={18} aria-hidden />
            New
          </button>
          <nav className="cloud-drive__nav">
            <button
              type="button"
              className={`cloud-drive__nav-item${path === "" ? " cloud-drive__nav-item--active" : ""}`}
              onClick={() => navigateTo("")}
            >
              <Folder size={18} aria-hidden />
              My Drive
            </button>
          </nav>
          {status?.quota && (
            <div className="cloud-drive__storage">
              <div className="cloud-drive__storage-label">
                <span>Storage</span>
                <span>
                  {status.quota.usedHuman} of {status.quota.totalHuman}
                </span>
              </div>
              <div className="cloud-drive__storage-bar" role="progressbar" aria-valuenow={status.quota.usedPercent ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="cloud-drive__storage-fill" style={{ width: `${Math.min(status.quota.usedPercent ?? 0, 100)}%` }} />
              </div>
            </div>
          )}
        </aside>

        <main className="cloud-drive__main">
          <header className="cloud-drive__toolbar">
            <div className="cloud-drive__search">
              <Search size={18} aria-hidden />
              <input
                type="search"
                placeholder="Search in Drive"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!status?.connected}
              />
            </div>
            <div className="cloud-drive__toolbar-actions">
              <div className="cloud-drive__view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={view === "list" ? "is-active" : ""}
                  onClick={() => setView("list")}
                  title="List view"
                >
                  <LayoutList size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  className={view === "grid" ? "is-active" : ""}
                  onClick={() => setView("grid")}
                  title="Grid view"
                >
                  <Grid3x3 size={18} aria-hidden />
                </button>
              </div>
              <button type="button" className="cloud-drive__icon-btn" onClick={() => void refresh()} disabled={loading} title="Refresh">
                <RefreshCw size={18} className={loading ? "cloud-spin" : undefined} aria-hidden />
              </button>
              {status?.baseUrl && (
                <button type="button" className="cloud-drive__icon-btn" onClick={openNextcloud} title="Open Nextcloud admin">
                  <ExternalLink size={18} aria-hidden />
                </button>
              )}
            </div>
          </header>

          <nav className="cloud-drive__breadcrumb" aria-label="Folder path">
            <button type="button" className="cloud-drive__crumb" onClick={() => navigateTo("")}>
              My Drive
            </button>
            {crumbs.map((segment, i) => {
              const target = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={target} className="cloud-drive__crumb-sep">
                  <ChevronRight size={16} aria-hidden />
                  <button type="button" className="cloud-drive__crumb" onClick={() => navigateTo(target)}>
                    {segment}
                  </button>
                </span>
              );
            })}
          </nav>

          <h1 className="cloud-drive__title">{folderLabel}</h1>

          {notReady && (
            <EmptyState
              className="cloud-empty"
              icon={<Cloud size={40} strokeWidth={1.25} aria-hidden />}
              title="Drive not connected"
              description={status?.message ?? "Check Nextcloud credentials in deploy/homelab/env/api.env, then reset the connection."}
              action={
                <>
                  <p className="cloud-empty__lead">
                    Sign in to Nextcloud in your browser first, then ensure <code>NEXTCLOUD_USERNAME</code> and{" "}
                    <code>NEXTCLOUD_PASSWORD</code> in <code>api.env</code> match that account.
                  </p>
                  {status?.baseUrl && (
                    <button type="button" className="cloud-drive__new cloud-drive__new--center" onClick={openNextcloud}>
                      Open Nextcloud
                    </button>
                  )}
                </>
              }
            />
          )}

          {status?.connected && (
            <>
              {error && (
                <p className="cloud-error" role="alert">
                  {error}
                </p>
              )}

              {loading ? (
                <div className="cloud-loading">
                  <div className="page-loading-spinner" aria-hidden />
                  <p>Loading your files…</p>
                </div>
              ) : sorted.length === 0 ? (
                <EmptyState
                  className="cloud-empty cloud-empty--inline"
                  icon={<Folder size={32} strokeWidth={1.25} aria-hidden />}
                  title={search ? "No matches" : "No files yet"}
                  description={search ? "Try a different search." : "Drop a file here or click New to upload."}
                  action={
                    !search ? (
                      <button type="button" className="cloud-drive__new cloud-drive__new--center" onClick={onUploadPick}>
                        <Upload size={18} aria-hidden />
                        Upload files
                      </button>
                    ) : undefined
                  }
                />
              ) : view === "grid" ? (
                <div className="cloud-grid">
                  {sorted.map((entry) => {
                    const Icon = fileIcon(entry);
                    return (
                      <article
                        key={entry.path}
                        className={`cloud-grid__card${entry.isDirectory ? " cloud-grid__card--folder" : ""}`}
                        onDoubleClick={() => (entry.isDirectory ? openFolder(entry) : void downloadFile(entry))}
                      >
                        <div className={`cloud-grid__icon${entry.isDirectory ? " cloud-grid__icon--folder" : ""}`}>
                          <Icon size={28} aria-hidden />
                        </div>
                        <p className="cloud-grid__name" title={entry.name}>
                          {entry.name}
                        </p>
                        <div className="cloud-grid__meta">
                          {!entry.isDirectory && <span>{formatSize(entry.size)}</span>}
                        </div>
                        <div className="cloud-grid__actions">
                          {!entry.isDirectory && (
                            <button type="button" title="Download" onClick={() => void downloadFile(entry)}>
                              <Download size={14} aria-hidden />
                            </button>
                          )}
                          <button type="button" title="Delete" onClick={() => void deleteEntry(entry)}>
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="cloud-list">
                  <div className="cloud-list__head" aria-hidden>
                    <span className="cloud-list__col cloud-list__col--name">Name</span>
                    <span className="cloud-list__col cloud-list__col--owner">Owner</span>
                    <span className="cloud-list__col cloud-list__col--date">Last modified</span>
                    <span className="cloud-list__col cloud-list__col--size">File size</span>
                    <span className="cloud-list__col cloud-list__col--actions" />
                  </div>
                  <ul className="cloud-list__body">
                    {sorted.map((entry) => {
                      const Icon = fileIcon(entry);
                      const menuOpen = menuPath === entry.path;
                      return (
                        <li key={entry.path} className="cloud-list__row">
                          <button
                            type="button"
                            className="cloud-list__col cloud-list__col--name cloud-list__name-btn"
                            onClick={() => (entry.isDirectory ? openFolder(entry) : void downloadFile(entry))}
                            onDoubleClick={() => entry.isDirectory && openFolder(entry)}
                          >
                            <span className={`cloud-list__icon${entry.isDirectory ? " cloud-list__icon--folder" : ""}`}>
                              <Icon size={20} aria-hidden />
                            </span>
                            <span className="cloud-list__filename">{entry.name}</span>
                          </button>
                          <span className="cloud-list__col cloud-list__col--owner">{status.username}</span>
                          <span className="cloud-list__col cloud-list__col--date">{formatDateRelative(entry.modified)}</span>
                          <span className="cloud-list__col cloud-list__col--size">
                            {entry.isDirectory ? "—" : formatSize(entry.size)}
                          </span>
                          <span className="cloud-list__col cloud-list__col--actions">
                            <button
                              type="button"
                              className="cloud-list__more"
                              aria-expanded={menuOpen}
                              onClick={() => setMenuPath(menuOpen ? null : entry.path)}
                            >
                              <MoreVertical size={18} aria-hidden />
                            </button>
                            {menuOpen && (
                              <div className="cloud-list__menu" role="menu">
                                {!entry.isDirectory && (
                                  <button type="button" role="menuitem" onClick={() => void downloadFile(entry)}>
                                    <Download size={16} aria-hidden />
                                    Download
                                  </button>
                                )}
                                <button type="button" role="menuitem" className="cloud-list__menu-danger" onClick={() => void deleteEntry(entry)}>
                                  <Trash2 size={16} aria-hidden />
                                  Remove
                                </button>
                              </div>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          <input ref={fileInputRef} type="file" hidden onChange={(ev) => void onUploadChange(ev)} />
        </main>
      </div>
    </div>
  );
}
