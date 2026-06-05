import type { Tab } from "../../App";
import { CHAT_AI_PROVIDER_LABELS, type ChatAIProviderId } from "../../lib/aiProvider";
import type { AIStatusPayload } from "../../lib/aiStatus";

type ModuleLink = {
  tab: Tab;
  label: string;
  hint: string;
  icon: string;
};

/** Odysseus icon-rail modules mapped to Cortex tabs (no separate Odysseus deploy). */
const MODULE_SECTIONS: Array<{ title: string; modules: ModuleLink[] }> = [
  {
    title: "Assistant",
    modules: [
      { tab: "ai", label: "Chat", hint: "Cloud AI chat", icon: "💬" },
      { tab: "notes", label: "Notes", hint: "Obsidian vault", icon: "📝" },
    ],
  },
  {
    title: "Productivity",
    modules: [
      { tab: "tasks", label: "Tasks", hint: "Board & planning", icon: "✓" },
      { tab: "calendar", label: "Calendar", hint: "Schedule", icon: "📅" },
      { tab: "mail", label: "Mail", hint: "Inbox + AI triage", icon: "✉" },
    ],
  },
  {
    title: "Media & home",
    modules: [
      { tab: "spotify", label: "Spotify", hint: "Stats + AI DJ", icon: "♫" },
      { tab: "homelab", label: "Homelab", hint: "Docker & NAS", icon: "⬡" },
      { tab: "cloud", label: "Cloud", hint: "Nextcloud", icon: "☁" },
    ],
  },
  {
    title: "System",
    modules: [{ tab: "settings", label: "Settings", hint: "Keys & OAuth", icon: "⚙" }],
  },
];

type Props = {
  status: AIStatusPayload | null;
  selectedProvider: ChatAIProviderId;
  activeTab?: Tab;
  onNavigate: (tab: Tab) => void;
};

export function AIWorkspaceSidebar({ status, selectedProvider, activeTab, onNavigate }: Props) {
  const cloud = status?.providers?.filter((p) => p.id !== "ollama" && p.available) ?? [];

  return (
    <aside className="ai-workspace-sidebar odysseus-rail" aria-label="Workspace modules">
      <div className="odysseus-rail__brand">
        <span className="odysseus-rail__logo" aria-hidden>
          ⊹
        </span>
        <div>
          <p className="odysseus-rail__title">Cortex workspace</p>
          <p className="odysseus-rail__sub">Inspired by Odysseus — cloud APIs, no local GPU</p>
        </div>
      </div>

      <div className="odysseus-rail__model">
        <span className="odysseus-rail__model-label">Model</span>
        <strong>{CHAT_AI_PROVIDER_LABELS[selectedProvider]}</strong>
        {cloud.length > 0 ? (
          <span className="odysseus-rail__model-meta">{cloud.map((p) => p.label).join(" · ")} ready</span>
        ) : (
          <span className="odysseus-rail__model-meta">Add API keys in Settings</span>
        )}
      </div>

      {MODULE_SECTIONS.map((section) => (
        <div key={section.title} className="odysseus-rail__section">
          <p className="odysseus-rail__section-title">{section.title}</p>
          <ul className="odysseus-rail__modules">
            {section.modules.map((m) => (
              <li key={m.tab}>
                <button
                  type="button"
                  className={`odysseus-rail__module ${activeTab === m.tab ? "odysseus-rail__module--active" : ""}`}
                  onClick={() => onNavigate(m.tab)}
                  title={m.hint}
                >
                  <span className="odysseus-rail__module-icon" aria-hidden>
                    {m.icon}
                  </span>
                  <span className="odysseus-rail__module-text">
                    <span className="odysseus-rail__module-label">{m.label}</span>
                    <span className="odysseus-rail__module-hint">{m.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="odysseus-rail__footer">
        Patterns from{" "}
        <a
          href="https://github.com/pewdiepie-archdaemon/odysseus"
          target="_blank"
          rel="noreferrer"
        >
          Odysseus
        </a>
        . Run models via Kimi/Claude/OpenAI — not Cookbook/GPU on this host.
      </p>
    </aside>
  );
}
