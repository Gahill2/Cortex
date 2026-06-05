import type { CanvasNode } from "../components/canvas/CanvasDashboard";

export type LayoutPreset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Omit<CanvasNode, "id">[];
};

// Widget size reference (from widgetRegistry STANDARD/TALL/COMPACT):
//   small:  STANDARD 260x180, TALL 260x200, COMPACT 280x160
//   medium: STANDARD 380x260, TALL 380x300, COMPACT 360x200
//   large:  STANDARD 480x340, TALL 520x400, COMPACT 440x240

export const PRESET_LAYOUTS: LayoutPreset[] = [
  {
    id: "focus",
    name: "Focus",
    description: "Clock + Tasks + Pomodoro timer for deep work sessions.",
    icon: "🎯",
    nodes: [
      {
        type: "widget",
        widgetKey: "clock",
        widgetVariant: "large",
        widgetSkin: "ios",
        x: -520,
        y: -200,
        w: 480,
        h: 340,
        zIndex: 1,
      },
      {
        type: "widget",
        widgetKey: "tasks",
        widgetVariant: "large",
        widgetSkin: "ios",
        x: 0,
        y: -200,
        w: 520,
        h: 400,
        zIndex: 2,
      },
      {
        type: "widget",
        widgetKey: "pomodoro",
        widgetVariant: "small",
        widgetSkin: "ios",
        x: -520,
        y: 180,
        w: 260,
        h: 180,
        zIndex: 3,
      },
    ],
  },
  {
    id: "morning-brief",
    name: "Morning Brief",
    description: "Today overview, weather, mail, and calendar for your daily start.",
    icon: "🌅",
    nodes: [
      {
        type: "widget",
        widgetKey: "today",
        widgetVariant: "large",
        widgetSkin: "ios",
        x: -460,
        y: -320,
        w: 440,
        h: 240,
        zIndex: 1,
      },
      {
        type: "widget",
        widgetKey: "weather",
        widgetVariant: "medium",
        widgetSkin: "ios",
        x: 20,
        y: -320,
        w: 380,
        h: 260,
        zIndex: 2,
      },
      {
        type: "widget",
        widgetKey: "mail",
        widgetVariant: "medium",
        widgetSkin: "ios",
        x: -460,
        y: -40,
        w: 380,
        h: 300,
        zIndex: 3,
      },
      {
        type: "widget",
        widgetKey: "calendar",
        widgetVariant: "medium",
        widgetSkin: "cortex",
        x: 20,
        y: -40,
        w: 380,
        h: 300,
        zIndex: 4,
      },
    ],
  },
  {
    id: "work-hub",
    name: "Work Hub",
    description: "Tasks, calendar, mail, and system status for a productive workday.",
    icon: "💼",
    nodes: [
      {
        type: "widget",
        widgetKey: "tasks",
        widgetVariant: "large",
        widgetSkin: "ios",
        x: -560,
        y: -200,
        w: 520,
        h: 400,
        zIndex: 1,
      },
      {
        type: "widget",
        widgetKey: "calendar",
        widgetVariant: "medium",
        widgetSkin: "cortex",
        x: 0,
        y: -200,
        w: 380,
        h: 300,
        zIndex: 2,
      },
      {
        type: "widget",
        widgetKey: "mail",
        widgetVariant: "medium",
        widgetSkin: "ios",
        x: 0,
        y: 140,
        w: 380,
        h: 300,
        zIndex: 3,
      },
      {
        type: "widget",
        widgetKey: "system",
        widgetVariant: "small",
        widgetSkin: "cortex",
        x: -560,
        y: 240,
        w: 280,
        h: 160,
        zIndex: 4,
      },
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Just a clock and daily quote — calm focus.",
    icon: "🪷",
    nodes: [
      {
        type: "widget",
        widgetKey: "clock",
        widgetVariant: "large",
        widgetSkin: "ios",
        x: -240,
        y: -220,
        w: 480,
        h: 340,
        zIndex: 1,
      },
      {
        type: "widget",
        widgetKey: "quote",
        widgetVariant: "medium",
        widgetSkin: "ios",
        x: -190,
        y: 160,
        w: 380,
        h: 260,
        zIndex: 2,
      },
    ],
  },
];
