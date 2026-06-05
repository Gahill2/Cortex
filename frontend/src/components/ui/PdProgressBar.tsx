interface Props {
  value: number;
  max?: number;
  tone?: "accent" | "success" | "warning";
}

export function PdProgressBar({ value, max = 100, tone = "accent" }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="pd-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`pd-progress__fill pd-progress__fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
