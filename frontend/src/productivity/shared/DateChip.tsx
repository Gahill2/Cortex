interface Props {
  date: string | Date;
  overdue?: boolean;
  compact?: boolean;
}

export function DateChip({ date, overdue, compact }: Props) {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const isToday = day.getTime() === today.getTime();

  const label = isToday
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <span
      className={`pd-date-chip${overdue ? " pd-date-chip--overdue" : ""}${isToday ? " pd-date-chip--today" : ""}${compact ? " pd-date-chip--compact" : ""}`}
    >
      {label}
    </span>
  );
}
