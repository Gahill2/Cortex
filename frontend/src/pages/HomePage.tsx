import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import type { Tab } from "../App";

// ── Types ─────────────────────────────────────────────────
type WidgetId = "clock" | "spotify" | "tasks" | "ai" | "gmail" | "settings";

const WIDGET_COLS: Record<WidgetId, number> = {
  clock:    1,
  spotify:  2,
  tasks:    1,
  ai:       2,
  gmail:    2,
  settings: 1,
};

const DEFAULT_ORDER: WidgetId[] = ["clock", "spotify", "tasks", "ai", "gmail", "settings"];
const STORAGE_KEY = "cortex_widget_order";

interface NowPlaying {
  playing: boolean;
  track?: { name: string; artists: string[]; albumArt?: string };
  device?: { name: string; volumePercent: number };
}
interface Task { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "DONE"; project: { name: string } }
interface GmailMsg { id: string; subject: string; from: string; unread: boolean }

interface Props { onNavigate: (tab: Tab) => void }

// ── Sortable wrapper ──────────────────────────────────────
function SortableWidget({
  id, editMode, colSpan, children,
}: {
  id: string;
  editMode: boolean;
  colSpan: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        gridColumn: `span ${colSpan}`,
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 1,
        position: "relative",
      }}
      animate={
        editMode && !isDragging
          ? { rotate: [-0.7, 0.7, -0.7], transition: { repeat: Infinity, duration: 0.28, ease: "easeInOut" } }
          : { rotate: 0 }
      }
      {...(editMode ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </motion.div>
  );
}

// ── Clock ─────────────────────────────────────────────────
function ClockWidget() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const hh = t.getHours().toString().padStart(2, "0");
  const mm = t.getMinutes().toString().padStart(2, "0");
  const ss = t.getSeconds().toString().padStart(2, "0");
  const date = t.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="widget widget--clock">
      <p className="clock-time">{hh}:{mm}<span className="clock-sec">:{ss}</span></p>
      <p className="clock-date">{date}</p>
      <div className="widget-status-row">
        <span className="widget-status-dot" />
        <span className="widget-status-text">Cortex online</span>
      </div>
    </div>
  );
}

// ── Spotify ───────────────────────────────────────────────
function SpotifyWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [loading, setLoading]     = useState(true);
  const [connected, setConnected] = useState(false);
  const [np, setNp]               = useState<NowPlaying | null>(null);

  const load = async () => {
    try {
      const s = await api.get<{ data?: { connected?: boolean } }>("/spotify/status");
      const conn = s.data?.data?.connected ?? false;
      setConnected(conn);
      if (conn) {
        const r = await api.get("/spotify/now-playing");
        setNp(r.data?.data ?? r.data ?? null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const ctrl = async (action: string) => {
    try { await api.post(`/spotify/playback/${action}`); setTimeout(load, 700); } catch { /* ignore */ }
  };

  return (
    <div className={`widget widget--spotify ${connected && np?.playing ? "widget--spotify-active" : ""}`}>
      <div className="widget-label">♫ Spotify</div>
      {loading ? <p className="widget-empty">Checking…</p>
        : !connected ? (
          <div className="widget-cta">
            <p className="widget-cta-text">Not connected</p>
            <button className="widget-cta-btn" onClick={() => onNavigate("settings")}>Connect in Settings →</button>
          </div>
        ) : !np?.playing ? (
          <p className="widget-empty">Nothing playing — open Spotify to start</p>
        ) : (
          <>
            <div className="spotify-widget-body">
              <div className="spotify-widget-art">
                {np.track?.albumArt ? <img src={np.track.albumArt} alt="" /> : <div className="spotify-art-fallback">♫</div>}
              </div>
              <div className="spotify-widget-info">
                <p className="spotify-widget-track">{np.track?.name}</p>
                <p className="spotify-widget-artist">{np.track?.artists?.join(", ")}</p>
                {np.device && <p className="spotify-widget-device">▸ {np.device.name}</p>}
              </div>
            </div>
            <div className="spotify-widget-controls">
              <button onClick={() => void ctrl("previous")}>⏮</button>
              <button className="spotify-pp" onClick={() => void ctrl(np.playing ? "pause" : "play")}>
                {np.playing ? "⏸" : "▶"}
              </button>
              <button onClick={() => void ctrl("next")}>⏭</button>
              <button className="spotify-refresh" onClick={load}>↻</button>
            </div>
          </>
        )}
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────
function TasksWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    api.get("/tasks").then((r) => {
      const t: Task[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
      setTasks(t);
    }).catch(() => { /* ignore */ });
  }, []);
  const todo = tasks.filter((t) => t.status === "TODO");
  const inProg = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");
  return (
    <div className="widget widget--tasks" onClick={() => onNavigate("tasks")} role="button" tabIndex={0}>
      <div className="widget-label">✓ Tasks</div>
      <div className="widget-task-stats">
        <div className="widget-task-stat"><span className="widget-task-num">{todo.length}</span><span className="widget-task-lbl">To do</span></div>
        <div className="widget-task-stat widget-task-stat--active"><span className="widget-task-num">{inProg.length}</span><span className="widget-task-lbl">Active</span></div>
        <div className="widget-task-stat widget-task-stat--done"><span className="widget-task-num">{done.length}</span><span className="widget-task-lbl">Done</span></div>
      </div>
      <ul className="widget-task-list">
        {[...inProg, ...todo].slice(0, 6).map((t) => (
          <li key={t.id} className={`widget-task-item ${t.status === "IN_PROGRESS" ? "widget-task-item--active" : ""}`}>
            <span className="widget-task-dot">{t.status === "IN_PROGRESS" ? "◑" : "○"}</span>
            <span className="widget-task-title">{t.title}</span>
          </li>
        ))}
        {tasks.length === 0 && <li className="widget-empty">No tasks yet</li>}
      </ul>
      <div className="widget-open-hint">Click to open Tasks →</div>
    </div>
  );
}

// ── AI ────────────────────────────────────────────────────
function AIWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [prompt, setPrompt]   = useState("");
  const [reply, setReply]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const msg = prompt.trim();
    if (!msg) return;
    setLoading(true);
    setReply(null);
    try {
      const r = await api.post("/ai/chat", { message: msg });
      setReply(r.data?.data?.reply ?? r.data?.reply ?? "Done.");
      setPrompt("");
    } catch { setReply("Unavailable."); }
    finally { setLoading(false); }
  };

  return (
    <div className="widget widget--ai">
      <div className="widget-label">◈ AI Assistant</div>
      {reply
        ? <div className="widget-ai-reply"><p>{reply}</p><button onClick={() => setReply(null)}>×</button></div>
        : <p className="widget-ai-idle">Ask anything or open full chat below</p>
      }
      <form className="widget-ai-form" onSubmit={send} onClick={(e) => e.stopPropagation()}>
        <input className="widget-ai-input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Quick question…" disabled={loading} />
        <button type="submit" className="widget-ai-send" disabled={loading || !prompt.trim()}>
          {loading ? "…" : "→"}
        </button>
      </form>
      <button className="widget-open-hint" onClick={() => onNavigate("ai")}>Open full chat →</button>
    </div>
  );
}

// ── Gmail ─────────────────────────────────────────────────
function GmailWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages]   = useState<GmailMsg[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get<{ data?: { connected?: boolean } }>("/gmail/status").then(async (s) => {
      const conn = s.data?.data?.connected ?? false;
      setConnected(conn);
      if (conn) {
        const r = await api.get("/gmail/inbox", { params: { maxResults: 8 } });
        setMessages(r.data?.data?.messages ?? []);
      }
    }).catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const unread = messages.filter((m) => m.unread).length;

  return (
    <div className="widget widget--gmail" onClick={() => onNavigate("gmail")} role="button" tabIndex={0}>
      <div className="widget-label">
        ✉ Gmail {unread > 0 && <span className="widget-gmail-badge">{unread}</span>}
      </div>
      {loading ? <p className="widget-empty">Loading…</p>
        : !connected ? (
          <div className="widget-cta">
            <p className="widget-cta-text">Not connected</p>
            <button className="widget-cta-btn" onClick={(e) => { e.stopPropagation(); onNavigate("gmail"); }}>
              Connect Gmail →
            </button>
          </div>
        ) : (
          <ul className="gmail-widget-list">
            {messages.slice(0, 6).map((m) => (
              <li key={m.id} className={`gmail-widget-row ${m.unread ? "unread" : ""}`}>
                <span className="gmail-widget-dot">{m.unread ? "●" : "○"}</span>
                <div className="gmail-widget-body">
                  <span className="gmail-widget-from">{m.from.split("<")[0].trim().slice(0, 20)}</span>
                  <span className="gmail-widget-subject">{m.subject || "(no subject)"}</span>
                </div>
              </li>
            ))}
            {messages.length === 0 && <li className="widget-empty">Inbox empty</li>}
          </ul>
        )}
      <div className="widget-open-hint">Open Gmail →</div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────
function SettingsWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  return (
    <div className="widget widget--settings" onClick={() => onNavigate("settings")} role="button" tabIndex={0}>
      <div className="widget-label">⚙ Settings</div>
      <div className="widget-settings-links">
        {(["Spotify", "Gmail", "Account"] as const).map((item) => (
          <div key={item} className="widget-settings-row">
            <span>{item}</span>
            <span className="widget-settings-arrow">›</span>
          </div>
        ))}
      </div>
      <div className="widget-open-hint">Open Settings →</div>
    </div>
  );
}

// ── Home page ─────────────────────────────────────────────
export const HomePage = ({ onNavigate }: Props) => {
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetId[];
        if (parsed.length === DEFAULT_ORDER.length) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_ORDER;
  });
  const [editMode, setEditMode] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as WidgetId);
        const newIdx = prev.indexOf(over.id as WidgetId);
        const next = arrayMove(prev, oldIdx, newIdx);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "clock":    return <ClockWidget />;
      case "spotify":  return <SpotifyWidget onNavigate={onNavigate} />;
      case "tasks":    return <TasksWidget onNavigate={onNavigate} />;
      case "ai":       return <AIWidget onNavigate={onNavigate} />;
      case "gmail":    return <GmailWidget onNavigate={onNavigate} />;
      case "settings": return <SettingsWidget onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="page home-page">
      <div className="page-titlebar">
        <div>
          <p className="page-eyebrow">{greeting()}</p>
          <h1 className="page-title">Home</h1>
        </div>
        <div className="page-actions">
          <AnimatePresence mode="wait">
            {editMode ? (
              <motion.button
                key="done"
                className="btn-primary btn-sm"
                onClick={() => setEditMode(false)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                Done
              </motion.button>
            ) : (
              <motion.button
                key="edit"
                className="btn-ghost btn-sm"
                onClick={() => setEditMode(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                ✦ Edit widgets
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {editMode && (
        <motion.p
          className="edit-mode-hint"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Drag widgets to rearrange • Click Done when finished
        </motion.p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="widget-grid">
            {widgetOrder.map((id) => (
              <SortableWidget
                key={id}
                id={id}
                editMode={editMode}
                colSpan={WIDGET_COLS[id]}
              >
                <div className={`widget-shell ${editMode ? "widget-shell--edit" : ""}`}
                  onMouseDown={editMode ? undefined : undefined}
                >
                  {renderWidget(id)}
                </div>
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};
