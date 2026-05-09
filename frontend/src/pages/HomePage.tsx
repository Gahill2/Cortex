import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Tab } from "../App";

interface NowPlaying {
  isPlaying: boolean;
  track?: { name: string; artists: string; albumArt?: string };
  device?: { name: string; volumePercent: number };
}

interface Task {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  project: { name: string };
}

interface Props {
  onNavigate: (tab: Tab) => void;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const control = async (action: string, onRefresh: () => void) => {
  try {
    await api.post(`/spotify/playback/${action}`);
    setTimeout(onRefresh, 600);
  } catch { /* ignore */ }
};

export const HomePage = ({ onNavigate }: Props) => {
  const [nowPlaying, setNowPlaying]         = useState<NowPlaying | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [quickPrompt, setQuickPrompt]       = useState("");
  const [quickReply, setQuickReply]         = useState<string | null>(null);
  const [aiLoading, setAiLoading]           = useState(false);
  const [time, setTime]                     = useState(new Date());

  useEffect(() => {
    void loadSpotify();
    void loadTasks();
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const loadSpotify = async () => {
    setSpotifyLoading(true);
    try {
      const s = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      const connected = s.data?.data?.connected ?? false;
      setSpotifyConnected(connected);
      if (connected) {
        const np = await api.get("/spotify/now-playing");
        setNowPlaying(np.data?.data ?? np.data ?? null);
      }
    } catch { /* ignore */ }
    finally { setSpotifyLoading(false); }
  };

  const loadTasks = async () => {
    try {
      const res = await api.get("/tasks");
      const t: Task[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setTasks(t);
    } catch { /* ignore */ }
  };

  const sendQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = quickPrompt.trim();
    if (!msg) return;
    setAiLoading(true);
    setQuickReply(null);
    try {
      const res = await api.post("/ai/chat", { message: msg });
      setQuickReply(res.data?.data?.reply ?? res.data?.reply ?? "Done.");
      setQuickPrompt("");
    } catch {
      setQuickReply("AI unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const todo       = tasks.filter((t) => t.status === "TODO");
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done       = tasks.filter((t) => t.status === "DONE");

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  const ss = time.getSeconds().toString().padStart(2, "0");
  const dateStr = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="page home-page">
      <div className="page-titlebar">
        <div>
          <p className="page-eyebrow">{greeting()}</p>
          <h1 className="page-title">Home</h1>
        </div>
      </div>

      <div className="widget-grid">

        {/* ── Clock widget ── */}
        <div className="widget widget--clock">
          <p className="clock-time">{hh}:{mm}<span className="clock-sec">:{ss}</span></p>
          <p className="clock-date">{dateStr}</p>
          <div className="widget-status-row">
            <span className="widget-status-dot" />
            <span className="widget-status-text">System online</span>
          </div>
        </div>

        {/* ── Spotify widget ── */}
        <div
          className={`widget widget--spotify ${spotifyConnected && nowPlaying?.isPlaying ? "widget--spotify-active" : ""}`}
          onClick={() => !spotifyConnected && onNavigate("settings")}
          style={{ cursor: spotifyConnected ? "default" : "pointer" }}
        >
          <div className="widget-label">♫ Spotify</div>
          {spotifyLoading ? (
            <p className="widget-empty">Checking…</p>
          ) : !spotifyConnected ? (
            <div className="widget-cta" onClick={(e) => { e.stopPropagation(); onNavigate("settings"); }}>
              <p className="widget-cta-text">Not connected</p>
              <button className="widget-cta-btn">Connect in Settings →</button>
            </div>
          ) : !nowPlaying?.isPlaying ? (
            <p className="widget-empty">Nothing playing</p>
          ) : (
            <div className="spotify-widget-body">
              <div className="spotify-widget-art">
                {nowPlaying.track?.albumArt
                  ? <img src={nowPlaying.track.albumArt} alt="Album" />
                  : <div className="spotify-art-fallback">♫</div>}
              </div>
              <div className="spotify-widget-info">
                <p className="spotify-widget-track">{nowPlaying.track?.name}</p>
                <p className="spotify-widget-artist">{nowPlaying.track?.artists}</p>
                {nowPlaying.device && <p className="spotify-widget-device">▸ {nowPlaying.device.name}</p>}
              </div>
            </div>
          )}
          {spotifyConnected && nowPlaying?.isPlaying && (
            <div className="spotify-widget-controls" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => void control("previous", loadSpotify)}>⏮</button>
              <button className="spotify-pp" onClick={() => void control(nowPlaying.isPlaying ? "pause" : "play", loadSpotify)}>
                {nowPlaying.isPlaying ? "⏸" : "▶"}
              </button>
              <button onClick={() => void control("next", loadSpotify)}>⏭</button>
              <button className="spotify-refresh" onClick={() => void loadSpotify()}>↻</button>
            </div>
          )}
        </div>

        {/* ── Tasks widget ── */}
        <div className="widget widget--tasks" onClick={() => onNavigate("tasks")} role="button" tabIndex={0}>
          <div className="widget-label">✓ Tasks</div>
          <div className="widget-task-stats">
            <div className="widget-task-stat">
              <span className="widget-task-num">{todo.length}</span>
              <span className="widget-task-lbl">To do</span>
            </div>
            <div className="widget-task-stat widget-task-stat--active">
              <span className="widget-task-num">{inProgress.length}</span>
              <span className="widget-task-lbl">Active</span>
            </div>
            <div className="widget-task-stat widget-task-stat--done">
              <span className="widget-task-num">{done.length}</span>
              <span className="widget-task-lbl">Done</span>
            </div>
          </div>
          <ul className="widget-task-list">
            {todo.slice(0, 4).map((t) => (
              <li key={t.id} className="widget-task-item">
                <span className="widget-task-dot">○</span>
                <span className="widget-task-title">{t.title}</span>
              </li>
            ))}
            {inProgress.slice(0, 2).map((t) => (
              <li key={t.id} className="widget-task-item widget-task-item--active">
                <span className="widget-task-dot">◑</span>
                <span className="widget-task-title">{t.title}</span>
              </li>
            ))}
            {tasks.length === 0 && <li className="widget-empty">No tasks yet</li>}
          </ul>
          <div className="widget-open-hint">Click to open Tasks →</div>
        </div>

        {/* ── AI widget ── */}
        <div className="widget widget--ai">
          <div className="widget-label">◈ AI Assistant</div>
          {quickReply ? (
            <div className="widget-ai-reply">
              <p>{quickReply}</p>
              <button className="widget-ai-reply-clear" onClick={() => setQuickReply(null)}>×</button>
            </div>
          ) : (
            <p className="widget-ai-idle">Ask anything or open the full chat below</p>
          )}
          <form className="widget-ai-form" onSubmit={sendQuick} onClick={(e) => e.stopPropagation()}>
            <input
              className="widget-ai-input"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Quick question…"
              disabled={aiLoading}
            />
            <button type="submit" className="widget-ai-send" disabled={aiLoading || !quickPrompt.trim()}>
              {aiLoading ? "…" : "→"}
            </button>
          </form>
          <button className="widget-open-hint" onClick={() => onNavigate("ai")}>
            Open full AI chat →
          </button>
        </div>

        {/* ── In-progress widget ── */}
        {inProgress.length > 0 && (
          <div className="widget widget--active-tasks" onClick={() => onNavigate("tasks")} role="button" tabIndex={0}>
            <div className="widget-label">◑ In Progress</div>
            <ul className="widget-task-list">
              {inProgress.map((t) => (
                <li key={t.id} className="widget-task-item widget-task-item--active">
                  <span className="widget-task-dot">◑</span>
                  <span className="widget-task-title">{t.title}</span>
                  <span className="widget-task-proj">{t.project.name}</span>
                </li>
              ))}
            </ul>
            <div className="widget-open-hint">Click to manage →</div>
          </div>
        )}

        {/* ── Settings / integrations widget ── */}
        <div className="widget widget--settings" onClick={() => onNavigate("settings")} role="button" tabIndex={0}>
          <div className="widget-label">⚙ Settings</div>
          <div className="widget-integrations">
            <div className={`widget-integration ${spotifyConnected ? "connected" : ""}`}>
              <span className="widget-integration-icon">♫</span>
              <span className="widget-integration-name">Spotify</span>
              <span className={`widget-integration-status ${spotifyConnected ? "on" : "off"}`}>
                {spotifyConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="widget-open-hint">Open Settings →</div>
        </div>

      </div>
    </div>
  );
};
