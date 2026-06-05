import type { PlannerEvent, PlannerTask } from "./types";

/** Local fallback when /ai/meeting-prep is unavailable. */
export function buildFocusSuggestion(tasks: PlannerTask[], events: PlannerEvent[]): string {
  const now = Date.now();
  const todayEvents = events
    .filter((e) => !e.allDay)
    .map((e) => ({ start: new Date(e.start).getTime(), end: new Date(e.end).getTime(), title: e.title }))
    .filter((e) => !Number.isNaN(e.start) && e.end > e.start)
    .sort((a, b) => a.start - b.start);

  const openToday = tasks.filter((t) => t.group === "today" && !t.completed);
  const high = openToday.find((t) => t.priority === "HIGH");

  if (todayEvents.length === 0) {
    if (high) {
      return `No meetings today — good window to focus on “${high.title}”.`;
    }
    if (openToday.length > 0) {
      return `Clear calendar today. Start with “${openToday[0].title}”.`;
    }
    return "No meetings or due tasks today. Block time for deep work or planning.";
  }

  for (let i = 0; i < todayEvents.length - 1; i++) {
    const gapMs = todayEvents[i + 1].start - todayEvents[i].end;
    const gapMin = Math.round(gapMs / 60000);
    if (gapMin >= 90) {
      const hours = Math.floor(gapMin / 60);
      const mins = gapMin % 60;
      const label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      const hint = high ? ` Consider “${high.title}”.` : "";
      return `You have a ${label} gap before “${todayEvents[i + 1].title}”.${hint}`;
    }
  }

  const next = todayEvents.find((e) => e.start >= now);
  if (next && high) {
    return `Next up: “${next.title}”. After that, tackle “${high.title}”.`;
  }
  if (next) {
    return `Next up: “${next.title}”. Use gaps between meetings for smaller tasks.`;
  }

  return `${todayEvents.length} meeting${todayEvents.length === 1 ? "" : "s"} today. Protect time between them for focused work.`;
}
