import { useEffect, useState } from "react";
import { api } from "../api/client";
import { SpotifyWidget } from "../components/SpotifyWidget";

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

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export const HomePage = () => {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickReply, setQuickReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    void loadSpotify();
    void loadTasks();
  }, []);

  const loadSpotify = async () => {
    try {
      const s = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      const connected = s.data?.data?.connected ?? false;
      setSpotifyConnected(connected);
      if (connected) {
        const np = await api.get("/spotify/now-playing");
        setNowPlaying(np.data?.data ?? np.data ?? null);
      }
    } catch { /* ignore */ }
  };

  const loadTasks = async () => {
    try {
      const res = await api.get("/tasks");
      const t: Task[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setTasks(t);
    } catch { /* ignore */ }
  };

  const sendQuick = async () => {
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

  const open   = tasks.filter((t) => t.status === "TODO").length;
  const active = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const done   = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="page">
      <div className="page-titlebar">
        <div>
          <p className="page-eyebrow">{greeting()}</p>
          <h1 className="page-title">Home</h1>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-value">{open}</p>
          <p className="stat-label">To do</p>
        </div>
        <div className="stat-card stat-card--active">
          <p className="stat-value">{active}</p>
          <p className="stat-label">In progress</p>
        </div>
        <div className="stat-card stat-card--done">
          <p className="stat-value">{done}</p>
          <p className="stat-label">Done</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{tasks.length}</p>
          <p className="stat-label">Total tasks</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="home-grid">
        {/* Left col */}
        <div className="home-col">
          <SpotifyWidget connected={spotifyConnected} nowPlaying={nowPlaying} onRefresh={loadSpotify} />

          {/* Recent tasks */}
          <div className="widget-card">
            <div className="widget-header">
              <h2 className="widget-title">Recent tasks</h2>
            </div>
            {tasks.length === 0 ? (
              <p className="widget-empty">No tasks yet</p>
            ) : (
              <ul className="task-list-mini">
                {tasks.slice(0, 8).map((t) => (
                  <li key={t.id} className={`task-list-mini-item ${t.status === "DONE" ? "done" : ""}`}>
                    <span className="task-mini-dot">
                      {t.status === "DONE" ? "●" : t.status === "IN_PROGRESS" ? "◑" : "○"}
                    </span>
                    <span className="task-mini-title">{t.title}</span>
                    <span className="task-mini-project">{t.project.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right col — AI */}
        <div className="home-col">
          <div className="widget-card widget-card--ai">
            <div className="widget-header">
              <h2 className="widget-title">◈ Quick AI</h2>
            </div>
            {quickReply && (
              <div className="quick-reply-box">
                <p className="quick-reply-text">{quickReply}</p>
              </div>
            )}
            <div className="quick-ai-row">
              <input
                className="quick-ai-input"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendQuick()}
                placeholder="Ask anything…"
              />
              <button
                className="quick-ai-btn"
                onClick={() => void sendQuick()}
                disabled={aiLoading || !quickPrompt.trim()}
              >
                {aiLoading ? "…" : "Ask →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
