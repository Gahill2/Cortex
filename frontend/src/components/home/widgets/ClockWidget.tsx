import { useEffect, useState } from "react";

export function ClockWidget() {
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