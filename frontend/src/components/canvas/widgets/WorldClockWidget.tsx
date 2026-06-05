import { useEffect, useState } from "react";
import { AnalogClockFace } from "./AnalogClockFace";

const DEFAULT_ZONES = [
  { label: "Local", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: "NYC", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
];

function formatTime(tz: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--";
  }
}

function formatDate(tz: string): string {
  try {
    return new Date().toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export interface WorldClockWidgetProps {
  /** list | digital-hero | analog | zones-grid */
  display?: string;
  layout?: "compact" | "default" | "expanded";
}

export function WorldClockWidget({ display = "list", layout = "default" }: WorldClockWidgetProps) {
  const [zones, setZones] = useState(DEFAULT_ZONES);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [addInput, setAddInput] = useState("");
  const primaryTz = zones[0]?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const compact = layout === "compact";

  useEffect(() => {
    const update = () => {
      const t: Record<string, string> = {};
      for (const z of zones) t[z.tz] = formatTime(z.tz);
      setTimes(t);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [zones]);

  const addZone = (e: React.FormEvent) => {
    e.preventDefault();
    const tz = addInput.trim();
    if (!tz) return;
    try {
      new Date().toLocaleTimeString("en-US", { timeZone: tz });
      setZones((prev) => [...prev, { label: tz.split("/").pop()!.replace(/_/g, " "), tz }]);
      setAddInput("");
    } catch {
      /* invalid timezone */
    }
  };

  const removeZone = (tz: string) => {
    setZones((prev) => prev.filter((z) => z.tz !== tz));
  };

  const addForm = !compact ? (
    <form className="worldclock-add" onSubmit={addZone}>
      <input
        className="worldclock-input"
        value={addInput}
        onChange={(e) => setAddInput(e.target.value)}
        placeholder="Add timezone (e.g. US/Pacific)"
        list="tz-suggestions"
      />
      <button type="submit" className="btn-ghost btn-sm">
        +
      </button>
      <datalist id="tz-suggestions">
        <option value="America/Los_Angeles" />
        <option value="America/Chicago" />
        <option value="Europe/Paris" />
        <option value="Europe/Berlin" />
        <option value="Asia/Shanghai" />
        <option value="Australia/Sydney" />
        <option value="Pacific/Auckland" />
      </datalist>
    </form>
  ) : null;

  if (display === "digital-hero") {
    return (
      <div className="worldclock-widget worldclock-widget--digital-hero">
        <div className="worldclock-digital-hero">
          <span className="worldclock-digital-hero__time">{times[primaryTz] ?? formatTime(primaryTz)}</span>
          <span className="worldclock-digital-hero__date">{formatDate(primaryTz)}</span>
          <span className="worldclock-label" style={{ opacity: 0.7 }}>
            {zones[0]?.label ?? "Local"}
          </span>
        </div>
        {addForm}
      </div>
    );
  }

  if (display === "analog") {
    const size = compact ? 88 : layout === "expanded" ? 140 : 110;
    return (
      <div className="worldclock-widget worldclock-widget--analog">
        <div className="worldclock-analog-wrap">
          <AnalogClockFace size={size} timeZone={primaryTz} />
          <span className="worldclock-label">{zones[0]?.label ?? "Local"}</span>
          <span className="worldclock-date">{formatDate(primaryTz)}</span>
        </div>
        {addForm}
      </div>
    );
  }

  if (display === "zones-grid") {
    const shown = compact ? zones.slice(0, 4) : zones;
    return (
      <div className="worldclock-widget worldclock-widget--grid">
        <div className="worldclock-zones-grid">
          {shown.map((z) => (
            <div key={z.tz} className="worldclock-zone-card">
              <div className="worldclock-zone-card__label">{z.label}</div>
              <div className="worldclock-zone-card__time">{times[z.tz] ?? "--:--"}</div>
            </div>
          ))}
        </div>
        {addForm}
      </div>
    );
  }

  return (
    <div className="worldclock-widget">
      <div className="worldclock-list">
        {zones.map((z) => (
          <div key={z.tz} className="worldclock-row">
            <div className="worldclock-info">
              <span className="worldclock-label">{z.label}</span>
              <span className="worldclock-date">{formatDate(z.tz)}</span>
            </div>
            <span className="worldclock-time">{times[z.tz] ?? "--:--"}</span>
            {zones.length > 1 && (
              <button className="worldclock-remove" onClick={() => removeZone(z.tz)} title="Remove" type="button">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {addForm}
    </div>
  );
}
