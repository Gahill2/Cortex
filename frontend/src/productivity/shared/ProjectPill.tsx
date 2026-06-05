interface Props {
  name: string;
  color?: string;
  compact?: boolean;
}

export function ProjectPill({ name, color = "#5b8dff", compact }: Props) {
  return (
    <span
      className={`pd-project-pill${compact ? " pd-project-pill--compact" : ""}`}
      style={{ ["--pill-color" as string]: color }}
    >
      <span className="pd-project-pill__dot" aria-hidden />
      {name}
    </span>
  );
}
