import { useEffect, useState } from "react";
import { api } from "../api/client";
import { SpotifyWidget } from "../components/SpotifyWidget";

interface NowPlaying {
  isPlaying: boolean;
  track?: { name: string; artists: string; albumArt?: string };
  device?: { name: string; volumePercent: number };
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
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickReply, setQuickReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    void loadSpotify();
    void loadTaskCount();
  }, []);

  const loadSpotify = async () => {
    try {
      const status = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      const connected = status.data?.data?.connected ?? false;
      setSpotifyConnected(connected);
      if (connected) {
        const np = await api.get("/spotify/now-playing");
        setNowPlaying(np.data?.data ?? np.data ?? null);
      }
    } catch {
      /* ignore */
    }
  };

  const loadTaskCount = async () => {
    try {
      const res = await api.get("/tasks");
      const tasks: Array<{ status: string }> = Array.isArray(res.data)
        ? res.data
        : (res.data?.data ?? []);
      setOpenTasks(tasks.filter((t) => t.status !== "DONE").length);
    } catch {
      /* ignore */
    }
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
      setQuickReply("AI unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="page home-page">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">{greeting()}</p>
          <h1 className="page-title">Cortex</h1>
        </div>
        <div className="status-dot" title="Online" />
      </header>

      <SpotifyWidget
        connected={spotifyConnected}
        nowPlaying={nowPlaying}
        onRefresh={loadSpotify}
      />

      {openTasks !== null && (
        <div className="home-card">
          <span className="home-card-icon">✓</span>
          <div>
            <p className="home-card-count">{openTasks}</p>
            <p className="home-card-label">open task{openTasks !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      <div className="quick-ai-card">
        <p className="quick-ai-label">Quick ask</p>
        {quickReply && <p className="quick-ai-reply">{quickReply}</p>}
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
            {aiLoading ? "…" : "→"}
          </button>
        </div>
      </div>
    </div>
  );
};
