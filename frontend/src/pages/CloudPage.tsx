import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  Folder,
  Home,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "../api/client";
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

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString();
}

export function CloudPage() {
  const pushToast = useToastStore((s) => s.push);
  const [status, setStatus] = useState<CloudStatusPayload | null>(null);
  const [path, setPath] = useState("");
  const [files, setFiles] = useState<CloudFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const navigateTo = (target: string) => {
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
    if (!window.confirm(`Delete "${entry.name}"?`)) return;
    try {
      await api.delete("/cloud/files", { params: { path: entry.path } });
      pushToast({ title: "Deleted", tone: "success" });
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
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const notReady = status && !status.connected;

  return (
    <div className="page cloud-page">
      <div className="page-titlebar cloud-page__head">
        <div>
          <h1 className="page-title">Cloud</h1>
          <p className="page-subtitle">
            Your own cloud on this PC (Nextcloud) — not Apple iCloud. Files stay on your homelab.
          </p>
        </div>
        <div className="cloud-page__actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "cloud-spin" : undefined} aria-hidden />
            Refresh
          </button>
          {status?.connected && (
            <>
              <button type="button" className="btn-primary btn-sm" onClick={onUploadPick} disabled={uploading}>
                <Upload size={16} aria-hidden />
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={(ev) => void onUploadChange(ev)} />
            </>
          )}
          {status?.baseUrl && (
            <button type="button" className="btn-ghost btn-sm" onClick={openNextcloud}>
              Open Nextcloud
              <ExternalLink size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {status?.quota && (
        <div className="cloud-quota" aria-label="Storage quota">
          <div className="cloud-quota__labels">
            <span>
              <Cloud size={16} aria-hidden /> {status.username}
            </span>
            <span>
              {status.quota.usedHuman} / {status.quota.totalHuman}
              {status.quota.usedPercent != null ? ` (${status.quota.usedPercent}%)` : ""}
            </span>
          </div>
          <div className="cloud-quota__bar" role="progressbar" aria-valuenow={status.quota.usedPercent ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="cloud-quota__fill"
              style={{ width: `${Math.min(status.quota.usedPercent ?? 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {notReady && (
        <EmptyState
          className="cloud-empty"
          icon={<Cloud size={40} strokeWidth={1.25} aria-hidden />}
          title="Cloud not connected yet"
          description={status?.message ?? "The API could not reach Nextcloud. Check credentials in deploy/homelab/env/api.env."}
          action={
            <>
              <p className="cloud-empty__lead">
                Cortex uses <strong>Nextcloud</strong> on this PC for file storage — it does not connect to Apple iCloud.
              </p>
              <ul className="cloud-empty__steps">
                <li>Open Nextcloud in your browser and sign in (admin account from deploy/nas/.env).</li>
                <li>Confirm the Cloud tab works after a refresh — trusted domains were updated for Docker.</li>
                <li>For the mobile Nextcloud app, use <code>{status?.baseUrl || "http://10.0.0.49:8081"}</code>.</li>
              </ul>
              {status?.baseUrl && (
                <button type="button" className="btn-primary" onClick={openNextcloud}>
                  Open Nextcloud
                </button>
              )}
            </>
          }
        />
      )}

      {status?.connected && (
        <>
          <nav className="cloud-breadcrumb" aria-label="Folder path">
            <button type="button" className="cloud-breadcrumb__item" onClick={() => navigateTo("")}>
              <Home size={14} aria-hidden />
              Home
            </button>
            {crumbs.map((segment, i) => {
              const target = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={target} className="cloud-breadcrumb__segment">
                  <ChevronRight size={14} aria-hidden />
                  <button type="button" className="cloud-breadcrumb__item" onClick={() => navigateTo(target)}>
                    {segment}
                  </button>
                </span>
              );
            })}
          </nav>

          {error && (
            <p className="cloud-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <div className="cloud-loading">
              <div className="page-loading-spinner" aria-hidden />
              <p>Loading files…</p>
            </div>
          ) : files.length === 0 ? (
            <EmptyState
              className="cloud-empty cloud-empty--inline"
              icon={<Folder size={32} strokeWidth={1.25} aria-hidden />}
              title="This folder is empty"
              description="Upload a file to get started."
            />
          ) : (
            <div className="cloud-table-wrap">
              <table className="cloud-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((entry) => (
                    <tr key={entry.path}>
                      <td>
                        <button
                          type="button"
                          className={`cloud-file-name${entry.isDirectory ? " cloud-file-name--dir" : ""}`}
                          onClick={() => (entry.isDirectory ? openFolder(entry) : downloadFile(entry))}
                        >
                          {entry.isDirectory ? <Folder size={16} aria-hidden /> : null}
                          {entry.name}
                        </button>
                      </td>
                      <td>{entry.isDirectory ? "—" : formatSize(entry.size)}</td>
                      <td>{formatDate(entry.modified)}</td>
                      <td className="cloud-table__actions">
                        {!entry.isDirectory && (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => void downloadFile(entry)} title="Download">
                            <Download size={14} aria-hidden />
                          </button>
                        )}
                        <button type="button" className="btn-ghost btn-sm" onClick={() => void deleteEntry(entry)} title="Delete">
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
