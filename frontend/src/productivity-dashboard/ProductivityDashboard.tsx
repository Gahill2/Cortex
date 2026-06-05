import { useEffect, useState } from "react";
import type { Tab } from "../tab";
import { useDashboardLayoutStore } from "./state/dashboardLayoutStore";
import { DashboardGrid } from "./DashboardGrid";
import { WidgetConfigPanel } from "./WidgetConfigPanel";
import { DashboardDataProvider } from "./hooks/useDashboardDataContext";

interface Props {
  onNavigate: (tab: Tab) => void;
  /** When HomePage owns the top bar, render grid body only */
  chrome?: "full" | "body";
  onConfigureWidget?: (id: string) => void;
  onAddWidgets?: () => void;
}

export function ProductivityDashboard({
  onNavigate,
  chrome = "full",
  onConfigureWidget,
  onAddWidgets,
}: Props) {
  const hydrate = useDashboardLayoutStore((s) => s.hydrate);
  const hydrated = useDashboardLayoutStore((s) => s.hydrated);
  const editMode = useDashboardLayoutStore((s) => s.editMode);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configIdInternal, setConfigIdInternal] = useState<string | null>(null);
  const widgets = useDashboardLayoutStore((s) => s.widgets);
  const configInstance = configIdInternal ? widgets.find((w) => w.id === configIdInternal) ?? null : null;
  const handleConfigure = onConfigureWidget ?? setConfigIdInternal;

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  if (!hydrated) {
    return <div className="pd-page pd-page--loading" aria-busy="true" />;
  }

  const body = (
    <>
      <main className="pd-main">
        <DashboardGrid
          onNavigate={onNavigate}
          selectedId={selectedId}
          onSelectWidget={setSelectedId}
          onConfigureWidget={handleConfigure}
          onAddWidgets={onAddWidgets}
        />
      </main>
      {onConfigureWidget ? null : (
        <WidgetConfigPanel instance={configInstance} onClose={() => setConfigIdInternal(null)} />
      )}
    </>
  );

  if (chrome === "body") {
    return <div className={`pd-page pd-page--embedded${editMode ? " pd-page--edit" : ""}`}>{body}</div>;
  }

  return (
    <DashboardDataProvider>
      <div className={`pd-page${editMode ? " pd-page--edit" : ""}`}>{body}</div>
    </DashboardDataProvider>
  );
}
