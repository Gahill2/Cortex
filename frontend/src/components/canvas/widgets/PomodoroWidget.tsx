import { useEffect, useRef, useState } from "react";

type Phase = "work" | "break" | "idle";

const PRESETS = [
  { label: "25/5", work: 25, break: 5 },
  { label: "50/10", work: 50, break: 10 },
  { label: "90/20", work: 90, break: 20 },
];

const SOUNDS: { id: string; label: string; url: string }[] = [
  { id: "none", label: "Silent", url: "" },
  { id: "rain", label: "Rain", url: "https://cdn.freesound.org/previews/531/531947_6902498-lq.mp3" },
  { id: "fire", label: "Fireplace", url: "https://cdn.freesound.org/previews/615/615073_1648170-lq.mp3" },
];

export function PomodoroWidget() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [sessions, setSessions] = useState(0);
  const [sound, setSound] = useState(SOUNDS[0]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (sound.url && phase === "work") {
      const a = new Audio(sound.url);
      a.loop = true;
      a.volume = 0.3;
      a.play().catch(() => {});
      audioRef.current = a;
    }
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, [sound, phase]);

  const start = () => {
    const secs = preset.work * 60;
    setSecondsLeft(secs);
    setTotalSeconds(secs);
    setPhase("work");
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (secondsLeft === 0 && phase === "work") {
      setSessions((s) => s + 1);
      const breakSecs = preset.break * 60;
      setSecondsLeft(breakSecs);
      setTotalSeconds(breakSecs);
      setPhase("break");
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setPhase("idle");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [secondsLeft, phase, preset]);

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase("idle");
    setSecondsLeft(preset.work * 60);
    setTotalSeconds(preset.work * 60);
  };

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  return (
    <div className="pomodoro-widget">
      <div className="pomodoro-ring" style={{ "--progress": progress } as React.CSSProperties}>
        <span className="pomodoro-time">{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
        <span className="pomodoro-phase">{phase === "idle" ? "Ready" : phase === "work" ? "Focus" : "Break"}</span>
      </div>

      <div className="pomodoro-controls">
        {phase === "idle" ? (
          <button className="btn-primary btn-sm" onClick={start}>Start</button>
        ) : (
          <button className="btn-ghost btn-sm" onClick={stop}>Stop</button>
        )}
      </div>

      <div className="pomodoro-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`pomodoro-preset-btn${preset.label === p.label ? " is-active" : ""}`}
            onClick={() => { setPreset(p); if (phase === "idle") { setSecondsLeft(p.work * 60); setTotalSeconds(p.work * 60); } }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="pomodoro-footer">
        <select
          className="pomodoro-sound-select"
          value={sound.id}
          onChange={(e) => setSound(SOUNDS.find((s) => s.id === e.target.value) ?? SOUNDS[0])}
        >
          {SOUNDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <span className="pomodoro-sessions">{sessions} done</span>
      </div>
    </div>
  );
}
