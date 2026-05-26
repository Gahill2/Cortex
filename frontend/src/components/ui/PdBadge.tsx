type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

interface Props {
  children: React.ReactNode;
  tone?: Tone;
}

export function PdBadge({ children, tone = "neutral" }: Props) {
  return <span className={`pd-badge pd-badge--${tone}`}>{children}</span>;
}
