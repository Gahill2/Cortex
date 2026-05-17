import { useEffect, useRef, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import type { Tab } from "../App";
import { HomeCanvaStrip } from "../components/home/HomeCanvaStrip";
import { HomeDashboardTop, type HomeBoardTask } from "../components/home/HomeDashboardTop";
import { HomeNotionHero } from "../components/home/HomeNotionHero";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";

// ── Types ─────────────────────────────────────────────────
type WidgetId = "clock" | "weather" | "briefing" | "spotify" | "tasks" | "ai" | "mail" | "settings" | "photo";

const WIDGET_COLS: Record<WidgetId, number> = {
  clock:    1,
  weather:  2,
  briefing: 2,
  spotify:  2,
  tasks:    1,
  ai:       2,
  mail:     2,
  settings: 1,
  photo:    1,
};

const WIDGET_ROWS: Record<WidgetId, number> = {
  clock: 1, weather: 1, briefing: 1, spotify: 1, tasks: 1, ai: 1, mail: 1, settings: 1, photo: 1,
};

const GRID_COLS = 4;
const GRID_ROWS = 6;
const GRID_KEY  = "cortex_widget_grid";

/** Single-column home on phones (grid + drag is desktop-first). */
const MOBILE_WIDGET_STACK: WidgetId[] = [
  "clock", "weather", "briefing", "tasks", "ai", "mail", "spotify", "settings", "photo",
];

/** Position + optional span overrides (defaults per widget in WIDGET_COLS/WIDGET_ROWS). */
type WidgetLayout = { col: number; row: number; colSpan?: number; rowSpan?: number };
type GridMap = Record<WidgetId, WidgetLayout>;

function spanCols(id: WidgetId, layout: WidgetLayout): number {
  return layout.colSpan ?? WIDGET_COLS[id];
}
function spanRows(id: WidgetId, layout: WidgetLayout): number {
  return layout.rowSpan ?? WIDGET_ROWS[id];
}

// Default non-overlapping layout
// Row 0: clock(1×1), photo(1×1), weather(2×1)
// Row 1: briefing(2×1), tasks(1×1), settings(1×1)
// Row 2: spotify(2×1), mail(2×1)
// Row 3: ai(2×1)
const DEFAULT_GRID: GridMap = {
  clock:    { col: 0, row: 0 },
  photo:    { col: 1, row: 0 },
  weather:  { col: 2, row: 0 },
  briefing: { col: 0, row: 1 },
  tasks:    { col: 2, row: 1 },
  settings: { col: 3, row: 1 },
  spotify:  { col: 0, row: 2 },
  mail:     { col: 2, row: 2 },
  ai:       { col: 0, row: 3 },
};

/** Optional span overrides for the widget being placed (resize / drag preview). */
function canPlace(
  grid: GridMap,
  widgetId: WidgetId,
  col: number,
  row: number,
  spanOverride?: { colSpan?: number; rowSpan?: number }
): boolean {
  const self = grid[widgetId];
  const cs = spanOverride?.colSpan ?? self.colSpan ?? WIDGET_COLS[widgetId];
  const rs = spanOverride?.rowSpan ?? self.rowSpan ?? WIDGET_ROWS[widgetId];
  if (col + cs > GRID_COLS || row + rs > GRID_ROWS) return false;
  if (cs < 1 || rs < 1) return false;
  for (const [id, pos] of Object.entries(grid) as [WidgetId, WidgetLayout][]) {
    if (id === widgetId) continue;
    const ocs = spanCols(id, pos);
    const ors = spanRows(id, pos);
    const noOverlap = col + cs <= pos.col || pos.col + ocs <= col || row + rs <= pos.row || pos.row + ors <= row;
    if (!noOverlap) return false;
  }
  return true;
}

function applyResize(grid: GridMap, widgetId: WidgetId, dCol: number, dRow: number): GridMap | null {
  const pos = grid[widgetId];
  const curCs = spanCols(widgetId, pos);
  const curRs = spanRows(widgetId, pos);
  const maxCs = GRID_COLS - pos.col;
  const maxRs = GRID_ROWS - pos.row;
  const nextCs = Math.max(1, Math.min(curCs + dCol, maxCs));
  const nextRs = Math.max(1, Math.min(curRs + dRow, maxRs));
  if (nextCs === curCs && nextRs === curRs) return null;
  if (!canPlace(grid, widgetId, pos.col, pos.row, { colSpan: nextCs, rowSpan: nextRs })) return null;
  return {
    ...grid,
    [widgetId]: { ...pos, colSpan: nextCs, rowSpan: nextRs },
  };
}

interface NowPlaying {
  playing: boolean;
  track?: { name: string; artists: string[]; albumArt?: string };
  device?: { name: string; volumePercent: number };
}
interface GmailMsg { id: string; subject: string; from: string; unread: boolean }
interface WeatherData {
  current: { temp: number; feelsLike: number; humidity: number; windSpeed: number; isDay: boolean; label: string; icon: string };
  forecast: Array<{ date: string; high: number; low: number; precipChance: number; label: string; icon: string }>;
  units: string;
}

interface Props { onNavigate: (tab: Tab) => void }

// ── Helpers ───────────────────────────────────────────────
function avatarColor(name: string): string {
  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

// ── Grid cell droppable ───────────────────────────────────
function GridCell({
  col,
  row,
  dragging,
  dropOk,
}: {
  col: number;
  row: number;
  /** Something is being dragged — highlight valid vs invalid targets */
  dragging: boolean;
  /** Placement legal for the active widget */
  dropOk: boolean;
}) {
  const disabled = dragging && !dropOk;
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${col}-${row}`, disabled });
  const showOver = isOver && dropOk;
  const cls = [
    "grid-cell",
    dragging ? (dropOk ? "grid-cell--valid" : "grid-cell--invalid") : "grid-cell--guide",
    showOver ? "grid-cell--over" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={setNodeRef}
      className={cls}
      style={{ gridColumn: `${col + 1}`, gridRow: `${row + 1}` }}
      aria-hidden
    />
  );
}

const WIDGET_LABELS: Record<WidgetId, string> = {
  clock: "Clock",
  weather: "Weather",
  briefing: "Briefing",
  spotify: "Spotify",
  tasks: "Tasks",
  ai: "AI",
  mail: "Mail",
  settings: "Settings",
  photo: "Photo",
};

// ── Draggable widget wrapper ──────────────────────────────
function GridWidget({
  id,
  col,
  row,
  colSpan,
  rowSpan,
  editMode,
  onResize,
  children,
}: {
  id: WidgetId;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  editMode: boolean;
  onResize: (dCol: number, dRow: number) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  const maxColsHere = GRID_COLS - col;
  const maxRowsHere = GRID_ROWS - row;
  const canWiden = colSpan < maxColsHere;
  const canShrinkW = colSpan > 1;
  const canTaller = rowSpan < maxRowsHere;
  const canShrinkH = rowSpan > 1;

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        gridColumn: `${col + 1} / span ${colSpan}`,
        gridRow: `${row + 1} / span ${rowSpan}`,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 20 : 2,
        position: "relative",
      }}
      {...attributes}
    >
      <div className={`widget-shell ${editMode ? "widget-shell--edit" : ""}`}>
        {editMode && (
          <div className="widget-edit-toolbar">
            <button
              type="button"
              className="widget-drag-handle"
              {...listeners}
              title="Drag to move"
            >
              <span className="widget-drag-grip" aria-hidden />
              <span className="widget-drag-label">Move</span>
            </button>
            <div className="widget-resize-cluster" role="group" aria-label="Resize tile">
              <span className="widget-resize-label">Span</span>
              <div className="widget-resize-row">
                <button
                  type="button"
                  className="widget-resize-btn"
                  disabled={!canShrinkW}
                  title="Narrower (−1 column)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize(-1, 0);
                  }}
                >
                  W−
                </button>
                <button
                  type="button"
                  className="widget-resize-btn"
                  disabled={!canWiden}
                  title="Wider (+1 column)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize(1, 0);
                  }}
                >
                  W+
                </button>
                <button
                  type="button"
                  className="widget-resize-btn"
                  disabled={!canShrinkH}
                  title="Shorter (−1 row)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize(0, -1);
                  }}
                >
                  H−
                </button>
                <button
                  type="button"
                  className="widget-resize-btn"
                  disabled={!canTaller}
                  title="Taller (+1 row)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize(0, 1);
                  }}
                >
                  H+
                </button>
              </div>
              <span className="widget-resize-size">
                {colSpan}×{rowSpan}
              </span>
            </div>
          </div>
        )}
        <div className="widget-edit-body">{children}</div>
      </div>
    </motion.div>
  );
}

// Floating clone shown by DragOverlay
function DragClone({ id, colSpan, rowSpan }: { id: WidgetId; colSpan: number; rowSpan: number }) {
  return (
    <motion.div
      style={{
        minWidth: Math.min(560, 120 + colSpan * 148),
        minHeight: 72 + rowSpan * 96,
      }}
      className="widget-drag-preview-wrap"
      initial={{ scale: 1 }}
      animate={{
        scale: 1.02,
        boxShadow: "0 24px 56px rgba(0,0,0,0.55), 0 0 0 2px var(--accent)",
      }}
      transition={{ duration: 0.15 }}
    >
      <div className="widget-shell widget-shell--dragging-clone widget-drag-preview">
        <span className="widget-drag-preview-title">{WIDGET_LABELS[id]}</span>
        <span className="widget-drag-preview-meta">
          {colSpan}×{rowSpan} • drop on highlighted cells
        </span>
      </div>
    </motion.div>
  );
}

// ── Clock ─────────────────────────────────────────────────
function ClockWidget() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const raw = t.getHours();
  const ampm = raw >= 12 ? "PM" : "AM";
  const hh = (raw % 12 || 12).toString().padStart(2, "0");
  const mm = t.getMinutes().toString().padStart(2, "0");
  const ss = t.getSeconds().toString().padStart(2, "0");
  const dayOfWeek = t.toLocaleDateString("en-US", { weekday: "long" });
  const fullDate = t.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="widget widget--clock">
      <p className="clock-time">
        <span className="clock-time-shimmer">{hh}</span>
        <span className="clock-colon-sep">:</span>
        <span className="clock-time-shimmer">{mm}</span>
        <span className="clock-sec">
          <span className="clock-colon-sep">:</span>{ss}
        </span>
        <span className="clock-ampm"> {ampm}</span>
      </p>
      <p className="clock-date" style={{ fontWeight: 600 }}>{dayOfWeek}</p>
      <p className="clock-date" style={{ opacity: 0.6, fontSize: "11px" }}>{fullDate}</p>
      <div className="widget-status-row">
        <span className="widget-status-dot" />
        <span className="widget-status-text">Cortex online</span>
      </div>
    </div>
  );
}

// ── Weather ───────────────────────────────────────────────
const SAVED_LOC_KEY = "cortex_weather_location";

interface SavedLocation { lat: number; lon: number; name: string }

function WeatherWidget() {
  const [data, setData]       = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [units, setUnits]     = useState<"fahrenheit" | "celsius">(() =>
    (localStorage.getItem("cortex_weather_units") as "fahrenheit" | "celsius") ?? "fahrenheit"
  );
  const [savedLoc, setSavedLoc] = useState<SavedLocation | null>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_LOC_KEY) ?? "null"); } catch { return null; }
  });
  const [cityInput, setCityInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchWeather = async (lat: number, lon: number, u: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/weather", { params: { lat, lon, units: u } });
      setData(r.data?.data ?? null);
    } catch {
      setError("Weather unavailable");
    } finally {
      setLoading(false);
    }
  };

  // Load on mount if we have a saved location, otherwise try geolocation
  useEffect(() => {
    if (savedLoc) {
      void fetchWeather(savedLoc.lat, savedLoc.lon, units);
      return;
    }
    if (!navigator.geolocation) { setError("Enter a city to get weather"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: SavedLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "Current location" };
        setSavedLoc(loc);
        localStorage.setItem(SAVED_LOC_KEY, JSON.stringify(loc));
        void fetchWeather(loc.lat, loc.lon, units);
      },
      () => setError("Enter a city below to get weather")
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when units change (if we have a location)
  useEffect(() => {
    if (savedLoc) void fetchWeather(savedLoc.lat, savedLoc.lon, units);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);

  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
      const d = await r.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
      const result = d.results?.[0];
      if (!result) { setSearchError("City not found"); return; }
      const loc: SavedLocation = { lat: result.latitude, lon: result.longitude, name: `${result.name}, ${result.country}` };
      setSavedLoc(loc);
      localStorage.setItem(SAVED_LOC_KEY, JSON.stringify(loc));
      setCityInput("");
      void fetchWeather(loc.lat, loc.lon, units);
    } catch {
      setSearchError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggleUnits = () => {
    const next = units === "fahrenheit" ? "celsius" : "fahrenheit";
    setUnits(next);
    localStorage.setItem("cortex_weather_units", next);
  };

  const clearLocation = () => {
    setSavedLoc(null);
    setData(null);
    localStorage.removeItem(SAVED_LOC_KEY);
    setError("Enter a city below to get weather");
  };

  const sym = units === "fahrenheit" ? "°F" : "°C";

  return (
    <div className="widget widget--weather">
      <div className="widget-label-row">
        <span className="widget-label">🌤 Weather</span>
        {savedLoc && <span className="weather-location-name" onClick={clearLocation} title="Change location">📍 {savedLoc.name}</span>}
        <button className="widget-units-btn" onClick={toggleUnits}>{sym}</button>
      </div>

      {loading && <p className="widget-empty">Loading…</p>}

      {!loading && !data && (
        <form className="weather-city-form" onSubmit={(e) => void searchCity(e)}>
          {error && <p className="widget-empty" style={{ marginBottom: 8 }}>{error}</p>}
          <div className="weather-city-row">
            <input
              className="weather-city-input"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Enter city name…"
              autoFocus
            />
            <button type="submit" className="btn-primary btn-sm" disabled={searching || !cityInput.trim()}>
              {searching ? "…" : "Go"}
            </button>
          </div>
          {searchError && <p className="weather-search-error">{searchError}</p>}
        </form>
      )}

      {data && !loading && (
        <>
          <div className="weather-current" style={{ flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span className="weather-icon-hero">{data.current.icon}</span>
            <span className="weather-temp-hero">{data.current.temp}{sym}</span>
            <span className="weather-label" style={{ textAlign: "center", marginBottom: 2 }}>{data.current.label}</span>
            <div className="weather-pills-row">
              <span className="weather-pill">Feels {data.current.feelsLike}{sym}</span>
              <span className="weather-pill">💧 {data.current.humidity}%</span>
              <span className="weather-pill">💨 {data.current.windSpeed} mph</span>
            </div>
          </div>
          <div className="weather-forecast">
            {data.forecast.slice(0, 5).map((day) => {
              const label = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
              return (
                <div key={day.date} className="weather-day-stacked">
                  <span className="weather-day-name">{label}</span>
                  <span className="weather-day-icon">{day.icon}</span>
                  <span className="weather-day-temps">
                    <span className="weather-day-high">{day.high}{sym}</span>{" "}
                    <span className="weather-day-low">{day.low}{sym}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {/* Change location inline */}
          <form className="weather-city-form weather-city-form--inline" onSubmit={(e) => void searchCity(e)}>
            <div className="weather-city-row">
              <input className="weather-city-input" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="Change city…" />
              <button type="submit" className="btn-ghost btn-sm" disabled={searching || !cityInput.trim()}>{searching ? "…" : "→"}</button>
            </div>
            {searchError && <p className="weather-search-error">{searchError}</p>}
          </form>
        </>
      )}
    </div>
  );
}

function readHomeGoalsForBriefing(): { text: string; done: boolean }[] {
  try {
    const raw = localStorage.getItem("cortex_home_goals");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ text?: string; done?: boolean }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((g) => ({ text: String(g.text ?? "").trim(), done: Boolean(g.done) }))
      .filter((g) => g.text.length > 0);
  } catch {
    return [];
  }
}

// ── AI Briefing ───────────────────────────────────────────
function BriefingWidget() {
  const [briefing, setBriefing]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.post("/ai/today-briefing", { goals: readHomeGoalsForBriefing() });
      const d = (r.data as { data?: { briefing?: string; generatedAt?: string } }).data;
      setBriefing(d?.briefing ?? null);
      setGeneratedAt(d?.generatedAt ?? null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    // Auto-load if not generated in last hour
    const last = localStorage.getItem("cortex_briefing_at");
    if (!last || Date.now() - new Date(last).getTime() > 3600_000) {
      void load();
    }
  }, []);

  useEffect(() => {
    if (generatedAt) localStorage.setItem("cortex_briefing_at", generatedAt);
  }, [generatedAt]);

  const timeAgo = () => {
    if (!generatedAt) return "";
    const diff = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  return (
    <div className="widget widget--briefing">
      <div className="widget-label-row">
        <span className="widget-label">✦ Daily Briefing</span>
        {generatedAt && <span className="briefing-time">{timeAgo()}</span>}
        <button className="widget-refresh-btn" onClick={() => void load()} disabled={loading} title="Refresh">↻</button>
      </div>
      {loading && <p className="widget-empty">Generating briefing…</p>}
      {!loading && briefing && (
        <div className="briefing-body-scroll">
          {briefing.split("\n").filter(Boolean).map((line, i) => (
            <div key={i} className="briefing-line">
              <div className="briefing-bullet" />
              <span>{line.replace(/^[-•*]\s*/, "")}</span>
            </div>
          ))}
          <span className="briefing-ai-badge">AI generated</span>
        </div>
      )}
      {!loading && !briefing && (
        <div className="widget-cta" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 22, opacity: 0.3 }}>✦</span>
          <p className="widget-cta-text" style={{ textAlign: "center" }}>No briefing yet</p>
          <button className="widget-cta-btn" onClick={() => void load()}>Generate today's briefing →</button>
        </div>
      )}
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
          <div className="spotify-cta-card">
            <span className="spotify-cta-icon">♫</span>
            <p className="spotify-cta-text">Connect Spotify to see what's playing</p>
            <button className="widget-cta-btn" onClick={() => onNavigate("settings")}>Connect in Settings →</button>
          </div>
        ) : !np?.playing ? (
          <p className="widget-empty">Nothing playing — open Spotify to start</p>
        ) : (
          <>
            <div className="spotify-widget-body">
              <div className={`spotify-widget-art ${np.playing ? "spotify-art-playing" : ""}`}
                   style={{ borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                {np.track?.albumArt
                  ? <img className="spotify-art-img" src={np.track.albumArt} alt="" />
                  : <div className="spotify-art-fallback-lg">♫</div>}
              </div>
              <div className="spotify-widget-info" style={{ minWidth: 0, flex: 1 }}>
                <p className="spotify-track-name">{np.track?.name}</p>
                <p className="spotify-artist-name">{np.track?.artists?.join(", ")}</p>
                {np.device && <p className="spotify-widget-device" style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>▸ {np.device.name}</p>}
              </div>
            </div>
            <div className="spotify-controls-row">
              <button className="spotify-ctrl-btn" onClick={() => void ctrl("previous")}>⏮</button>
              <button className="spotify-ctrl-btn spotify-ctrl-btn--pp" onClick={() => void ctrl(np.playing ? "pause" : "play")}>
                {np.playing ? "⏸" : "▶"}
              </button>
              <button className="spotify-ctrl-btn" onClick={() => void ctrl("next")}>⏭</button>
              <button className="spotify-ctrl-btn" style={{ fontSize: 14 }} onClick={load}>↻</button>
            </div>
            <div className="spotify-progress-bar-track">
              <div className="spotify-progress-bar-fill" />
            </div>
          </>
        )}
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────
function TasksWidget({
  onNavigate,
  tasks,
  loading,
}: {
  onNavigate: (t: Tab) => void;
  tasks: HomeBoardTask[];
  loading?: boolean;
}) {
  const todo = tasks.filter((t) => t.status === "TODO");
  const inProg = tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = tasks.filter((t) => t.status === "DONE");
  const total = tasks.length;
  const doneCount = done.length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const remaining = todo.length + inProg.length;

  // Simple priority heuristic based on status
  const priorityDot = (status: HomeBoardTask["status"]) => {
    if (status === "IN_PROGRESS") return "task-priority-dot--high";
    if (status === "TODO") return "task-priority-dot--medium";
    return "task-priority-dot--low";
  };

  return (
    <div className="widget widget--tasks" onClick={() => onNavigate("tasks")} role="button" tabIndex={0}>
      <div className="widget-label">✓ Tasks</div>
      {loading ? <p className="widget-empty">Loading…</p> : null}
      {!loading && total > 0 && (
        <div className="task-progress-bar">
          <div className="task-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
      <ul className="widget-task-list">
        {!loading &&
          [...inProg, ...todo].slice(0, 4).map((t) => (
            <li key={t.id} className={`widget-task-item ${t.status === "IN_PROGRESS" ? "widget-task-item--active" : ""}`}
                style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span className={`task-priority-dot ${priorityDot(t.status)}`} />
              <span className="widget-task-title">{t.title}</span>
            </li>
          ))}
        {!loading && tasks.length === 0 && (
          <li>
            <div className="tasks-empty-state">
              <span className="tasks-empty-icon">✓</span>
              <span>No tasks yet — add one in Tasks</span>
            </div>
          </li>
        )}
      </ul>
      {!loading && total > 0 && (
        <div className="task-count-footer">{remaining} task{remaining !== 1 ? "s" : ""} left · {doneCount} done</div>
      )}
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
      {reply && (
        <div className="widget-ai-bubble">
          {reply}
          <button className="widget-ai-bubble-close" onClick={() => setReply(null)}>×</button>
        </div>
      )}
      {!reply && <p className="widget-ai-idle" style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 8px" }}>Ask anything…</p>}
      <form className="widget-ai-form" onSubmit={send} onClick={(e) => e.stopPropagation()}>
        <div className="widget-ai-pill">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Quick question…"
            disabled={loading}
          />
          <button type="submit" className="widget-ai-pill-btn" disabled={loading || !prompt.trim()}>
            {loading ? "…" : "↑"}
          </button>
        </div>
      </form>
      <div style={{ marginTop: 8 }}>
        <button className="widget-ai-open-link" onClick={() => onNavigate("ai")}>Open full chat →</button>
      </div>
    </div>
  );
}

// ── Mail ──────────────────────────────────────────────────
function MailWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [hasAccounts, setHasAccounts] = useState(false);
  const [messages, setMessages]       = useState<GmailMsg[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    api.get<{ data?: { accounts: { id: string }[] } }>("/mail/accounts").then(async (s) => {
      const accounts = s.data?.data?.accounts ?? [];
      setHasAccounts(accounts.length > 0);
      if (accounts.length > 0) {
        const r = await api.get("/mail/inbox", { params: { unified: "true", maxResults: 8 } });
        setMessages(r.data?.data?.messages ?? []);
      }
    }).catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const unread = messages.filter((m) => m.unread).length;

  return (
    <div className="widget widget--gmail" onClick={() => onNavigate("mail")} role="button" tabIndex={0}>
      <div className="widget-label">
        ✉ Mail {unread > 0 && <span className="mail-unread-badge">{unread}</span>}
      </div>
      {loading ? <p className="widget-empty">Loading…</p>
        : !hasAccounts ? (
          <div className="widget-cta">
            <p className="widget-cta-text">No accounts connected</p>
            <button className="widget-cta-btn" onClick={(e) => { e.stopPropagation(); onNavigate("mail"); }}>
              Add account →
            </button>
          </div>
        ) : (
          <ul className="gmail-widget-list">
            {messages.slice(0, 6).map((m) => {
              const senderName = m.from.split("<")[0].trim() || m.from;
              const initial = senderName.charAt(0).toUpperCase();
              return (
                <li key={m.id} className={`gmail-row-v2 ${m.unread ? "unread" : ""}`}>
                  <div className="mail-avatar" style={{ background: avatarColor(senderName) }}>{initial}</div>
                  <div className="gmail-row-content">
                    <div className="gmail-row-from">{senderName.slice(0, 22)}</div>
                    <div className="gmail-row-subject">{m.subject || "(no subject)"}</div>
                  </div>
                </li>
              );
            })}
            {messages.length === 0 && <li className="widget-empty">Inbox empty</li>}
          </ul>
        )}
      <div className="widget-open-hint">Open Mail →</div>
    </div>
  );
}

// ── Photo ─────────────────────────────────────────────────
const PHOTO_KEY = "cortex_photo_widget";
interface PhotoConfig { url: string; label: string }

function PhotoWidget({ editMode }: { editMode: boolean }) {
  const [config, setConfig] = useState<PhotoConfig | null>(() => {
    try { return JSON.parse(localStorage.getItem(PHOTO_KEY) ?? "null"); } catch { return null; }
  });
  const [inputUrl, setInputUrl]     = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [editing, setEditing]       = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    const c: PhotoConfig = { url: inputUrl.trim(), label: inputLabel.trim() };
    localStorage.setItem(PHOTO_KEY, JSON.stringify(c));
    setConfig(c);
    setEditing(false);
    setInputUrl(""); setInputLabel("");
  };

  if (editing || (editMode && !config)) {
    return (
      <div className="widget widget--photo widget--photo-edit">
        <p className="widget-label">📷 Photo Widget</p>
        <form onSubmit={save} className="photo-edit-form">
          <input
            className="form-input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Image URL…"
            autoFocus
            required
          />
          <input
            className="form-input"
            value={inputLabel}
            onChange={(e) => setInputLabel(e.target.value)}
            placeholder="Caption (optional)"
          />
          <div className="photo-edit-actions">
            <button type="submit" className="btn-primary btn-sm">Set Photo</button>
            {config && <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="widget widget--photo widget--photo-empty" style={{ padding: 0 }}>
        <div className="photo-placeholder" onClick={() => setEditing(true)}>
          <span className="photo-placeholder-icon">📷</span>
          <span className="photo-placeholder-text">Tap to add a photo</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="widget widget--photo"
      style={{ backgroundImage: `url(${config.url})`, backgroundSize: "cover", backgroundPosition: "center", padding: 0 }}
      onClick={() => editMode && setEditing(true)}
      role={editMode ? "button" : undefined}
    >
      {config.label && (
        <div className="photo-widget-caption">
          <span>{config.label}</span>
        </div>
      )}
      {editMode && (
        <div className="photo-edit-overlay">
          <span>✎</span>
          <span>Set photo</span>
        </div>
      )}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────
const SETTINGS_ROWS = [
  { label: "Spotify", icon: "♫", connectedKey: "cortex_spotify_connected" },
  { label: "Mail", icon: "✉", connectedKey: null },
  { label: "Account", icon: "⚙", connectedKey: null },
] as const;

function SettingsWidget({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const spotifyConnected = !!localStorage.getItem("cortex_spotify_tokens");
  return (
    <div className="widget widget--settings" onClick={() => onNavigate("settings")} role="button" tabIndex={0}>
      <div className="widget-label">⚙ Settings</div>
      <div className="widget-settings-links">
        {SETTINGS_ROWS.map((item) => {
          const isConnected = item.label === "Spotify" ? spotifyConnected : false;
          return (
            <div key={item.label} className="settings-row-v2">
              <span className="settings-row-icon">{item.icon}</span>
              <span className="settings-row-label">{item.label}</span>
              <div className="settings-row-right">
                {item.label === "Spotify" && (
                  <span className={`settings-status-dot ${isConnected ? "settings-status-dot--connected" : "settings-status-dot--disconnected"}`} />
                )}
                <span className="settings-row-arrow">›</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="widget-open-hint">Open Settings →</div>
    </div>
  );
}

// ── Home page ─────────────────────────────────────────────
export const HomePage = ({ onNavigate }: Props) => {
  const { theme } = useTheme();
  const isNarrow = useMediaQuery("(max-width: 768px)");

  const [boardTasks, setBoardTasks] = useState<HomeBoardTask[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [boardDataLoading, setBoardDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBoardDataLoading(true);
    Promise.all([api.get("/tasks"), api.get("/projects")])
      .then(([tr, pr]) => {
        if (cancelled) return;
        const t: HomeBoardTask[] = Array.isArray(tr.data) ? tr.data : (tr.data?.data ?? []);
        const projects = Array.isArray(pr.data) ? pr.data : (pr.data?.data ?? []);
        setBoardTasks(t);
        setProjectsCount(projects.length);
      })
      .catch(() => {
        if (!cancelled) {
          setBoardTasks([]);
          setProjectsCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setBoardDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [gridMap, setGridMap] = useState<GridMap>(() => {
    try {
      const saved = localStorage.getItem(GRID_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GridMap;
        // Ensure all widgets exist
        const complete = { ...DEFAULT_GRID, ...parsed };
        return complete;
      }
    } catch { /* ignore */ }
    return DEFAULT_GRID;
  });

  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  void longPressRef; // unused but kept for future use

  const saveGrid = useCallback((g: GridMap) => {
    localStorage.setItem(GRID_KEY, JSON.stringify(g));
    setGridMap(g);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const bumpSpan = useCallback((widgetId: WidgetId, dCol: number, dRow: number) => {
    setGridMap((prev) => {
      const next = applyResize(prev, widgetId, dCol, dRow);
      if (!next) return prev;
      localStorage.setItem(GRID_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as WidgetId);
    setEditMode(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as WidgetId;
    const overId = over.id as string;

    if (overId.startsWith("cell-")) {
      const [, col, row] = overId.split("-").map(Number);
      setGridMap((prev) => {
        if (!canPlace(prev, draggedId, col, row)) return prev;
        const next = {
          ...prev,
          [draggedId]: { ...prev[draggedId], col, row },
        };
        localStorage.setItem(GRID_KEY, JSON.stringify(next));
        return next;
      });
    }
  };

  const resetBoardLayout = useCallback(() => {
    if (!window.confirm("Reset home board to the default positions and sizes?")) return;
    const fresh = JSON.parse(JSON.stringify(DEFAULT_GRID)) as GridMap;
    saveGrid(fresh);
  }, [saveGrid]);

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditMode(false);
        setActiveId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]);

  /** Show grid helpers whenever arranging layout or mid-drag */
  const showGridChrome = editMode || !!activeId;
  const editGridCells =
    showGridChrome &&
    Array.from({ length: GRID_ROWS }, (_, row) =>
      Array.from({ length: GRID_COLS }, (_, col) => ({
        col,
        row,
        dropOk: activeId ? canPlace(gridMap, activeId, col, row) : true,
      }))
    ).flat();

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "clock":    return <ClockWidget />;
      case "weather":  return <WeatherWidget />;
      case "briefing": return <BriefingWidget />;
      case "spotify":  return <SpotifyWidget onNavigate={onNavigate} />;
      case "tasks":    return <TasksWidget onNavigate={onNavigate} tasks={boardTasks} loading={boardDataLoading} />;
      case "ai":       return <AIWidget onNavigate={onNavigate} />;
      case "mail":     return <MailWidget onNavigate={onNavigate} />;
      case "settings": return <SettingsWidget onNavigate={onNavigate} />;
      case "photo":    return <PhotoWidget editMode={editMode} />;
    }
  };

  const homeHeader = (
    <div className="home-header">
      <div className="home-header-left">
        <p className="home-greeting">{greeting()}</p>
        <p className="home-kicker">Dashboard</p>
        {theme && <p className="home-theme-name">✦ {theme.name}</p>}
      </div>
      {!isNarrow && (
        <div className="page-actions">
          <AnimatePresence mode="wait">
            {editMode ? (
              <motion.div
                key="edit-actions"
                className="home-edit-actions"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <button type="button" className="btn-ghost btn-sm" onClick={() => void resetBoardLayout()}>
                  Reset layout
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={() => setEditMode(false)}>
                  Done
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="edit"
                className="btn-ghost btn-sm"
                onClick={() => setEditMode(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                ✦ Edit
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (isNarrow) {
    return (
      <div className="page home-page home-page--mobile-stack">
        <div className="container-fluid px-3 px-sm-4 pt-1 pb-2">
          {homeHeader}
          <HomeNotionHero onNavigate={onNavigate} />
          <HomeCanvaStrip onNavigate={onNavigate} />
          <HomeDashboardTop
            onNavigate={onNavigate}
            tasks={boardTasks}
            projectsCount={projectsCount}
            loading={boardDataLoading}
          />
          <p className="home-mobile-hint mb-3 mb-sm-4">
            Layout editing works on a wider screen. Pull down to scroll widgets.
          </p>
        </div>
        <div className="container-fluid px-3 px-sm-4 pb-4 pb-sm-5">
          <div className="row g-4">
            {MOBILE_WIDGET_STACK.map((id) => (
              <div key={id} className="col-12">
                <div className="cortex-home-mobile-card h-100">{renderWidget(id)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page home-page">
      {homeHeader}
      <div className="container-fluid px-3 px-sm-4 px-lg-0 pb-3">
        <HomeNotionHero onNavigate={onNavigate} />
        <HomeCanvaStrip onNavigate={onNavigate} />
        <HomeDashboardTop
          onNavigate={onNavigate}
          tasks={boardTasks}
          projectsCount={projectsCount}
          loading={boardDataLoading}
        />
      </div>

      {editMode && (
        <motion.p
          className="edit-mode-hint"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Move = drag • W± / H± = wider/narrower & taller/shorter • Esc or Done exits • Reset restores defaults
        </motion.p>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="home-board">
          <div className="widget-grid">
            {/* Drop zone cells (edit mode + mid-drag) */}
            {showGridChrome &&
              editGridCells &&
              editGridCells.map(({ col, row, dropOk }) => (
                <GridCell
                  key={`cell-${col}-${row}`}
                  col={col}
                  row={row}
                  dragging={!!activeId}
                  dropOk={dropOk}
                />
              ))}

            {/* Widgets */}
            {(Object.entries(gridMap) as [WidgetId, WidgetLayout][]).map(([id, pos]) => (
              <GridWidget
                key={id}
                id={id}
                col={pos.col}
                row={pos.row}
                colSpan={spanCols(id, pos)}
                rowSpan={spanRows(id, pos)}
                editMode={editMode}
                onResize={(dCol, dRow) => bumpSpan(id, dCol, dRow)}
              >
                {renderWidget(id)}
              </GridWidget>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeId && (
            <DragClone
              id={activeId}
              colSpan={spanCols(activeId, gridMap[activeId])}
              rowSpan={spanRows(activeId, gridMap[activeId])}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
