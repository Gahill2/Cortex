import { addDays, startOfDay } from "./utils/dateUtils";

export type TaskPriority = "high" | "medium" | "low";
export type TaskBucket = "inbox" | "today" | "upcoming" | "anytime" | "someday";

export interface MockTask {
  id: string;
  title: string;
  done: boolean;
  priority: TaskPriority;
  due?: string;
  project?: string;
  tags?: string[];
  bucket: TaskBucket;
}

export interface MockEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  calendar: string;
}

export interface MockGoal {
  id: string;
  title: string;
  progress: number;
  status: "on_track" | "at_risk" | "paused" | "complete";
  category: string;
  milestones: { id: string; label: string; done: boolean }[];
}

export interface MockHabit {
  id: string;
  label: string;
  streak: number;
  doneToday: boolean;
  week: boolean[];
  category: string;
}

export interface MockNote {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
}

export interface MockAutomation {
  id: string;
  label: string;
  status: "idle" | "running" | "ok";
  shortcut?: string;
}

export interface MockEmail {
  id: string;
  from: string;
  subject: string;
  preview: string;
  unread: boolean;
}

const today = startOfDay();

export const mockTasks: MockTask[] = [
  { id: "t1", title: "Review sprint priorities", done: false, priority: "high", due: "Today", project: "Cortex", tags: ["work"], bucket: "today" },
  { id: "t2", title: "Plan deep work block", done: false, priority: "medium", due: "Today", bucket: "today" },
  { id: "t3", title: "Reply to design feedback", done: true, priority: "low", due: "Today", bucket: "today" },
  { id: "t4", title: "Grocery run", done: false, priority: "medium", due: "Tomorrow", tags: ["errands"], bucket: "upcoming" },
  { id: "t5", title: "Draft Q2 goals outline", done: false, priority: "medium", bucket: "anytime", project: "Personal" },
  { id: "t6", title: "Learn Raycast shortcuts", done: false, priority: "low", bucket: "someday" },
];

export const mockEvents: MockEvent[] = [
  {
    id: "e1",
    title: "Focus block — Dashboard",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0).toISOString(),
    color: "var(--accent)",
    calendar: "Work",
  },
  {
    id: "e2",
    title: "Team sync",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 45).toISOString(),
    color: "var(--green)",
    calendar: "Work",
  },
  {
    id: "e3",
    title: "Evening walk",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30).toISOString(),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0).toISOString(),
    color: "var(--amber)",
    calendar: "Personal",
  },
  {
    id: "e4",
    title: "Dentist",
    start: addDays(today, 2).toISOString(),
    end: addDays(today, 2).toISOString(),
    color: "var(--red)",
    calendar: "Personal",
  },
];

export const mockGoals: MockGoal[] = [
  {
    id: "g1",
    title: "Ship Cortex home experience",
    progress: 68,
    status: "on_track",
    category: "Work",
    milestones: [
      { id: "m1", label: "Widget grid", done: true },
      { id: "m2", label: "Edit mode polish", done: false },
      { id: "m3", label: "Backend layout sync", done: false },
    ],
  },
  {
    id: "g2",
    title: "Consistent morning routine",
    progress: 42,
    status: "at_risk",
    category: "Health",
    milestones: [
      { id: "m4", label: "7-day streak", done: false },
      { id: "m5", label: "30-day streak", done: false },
    ],
  },
];

export const mockHabits: MockHabit[] = [
  { id: "h1", label: "Morning planning", streak: 12, doneToday: true, week: [true, true, false, true, true, true, true], category: "Focus" },
  { id: "h2", label: "Move 30 min", streak: 5, doneToday: false, week: [true, false, true, true, false, true, false], category: "Health" },
  { id: "h3", label: "Inbox zero", streak: 8, doneToday: true, week: [true, true, true, true, false, true, true], category: "Work" },
];

export const mockNotes: MockNote[] = [
  { id: "n1", title: "Today focus", preview: "Polish dashboard widgets and edit mode. Keep spacing calm.", pinned: true },
];

export const mockAutomations: MockAutomation[] = [
  { id: "a1", label: "Sync tasks", status: "ok", shortcut: "⌘⇧T" },
  { id: "a2", label: "Open command palette", status: "idle", shortcut: "⌘K" },
  { id: "a3", label: "Run daily review", status: "idle" },
];

export const mockEmails: MockEmail[] = [
  { id: "m1", from: "Alex Chen", subject: "Dashboard feedback", preview: "The new home grid feels much calmer…", unread: true },
  { id: "m2", from: "Calendar", subject: "Tomorrow: 3 events", preview: "Focus block, standup, dinner…", unread: false },
];

export const mockMusic = {
  title: "Deep Focus",
  artist: "Cortex Mix",
  albumArt: null as string | null,
};

export const mockSystem = {
  sync: "Local",
  api: "Connected",
  db: "Offline",
  lastSave: "Just now",
};
