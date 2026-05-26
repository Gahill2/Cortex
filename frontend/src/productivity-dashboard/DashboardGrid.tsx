import { useCallback, useRef, useState } from "react";
import type { Tab } from "../tab";
import { GRID_COLS, GRID_GAP, GRID_ROW_HEIGHT } from "./types";
import { useDashboardLayoutStore } from "./state/dashboardLayoutStore";
import { DashboardWidgetShell } from "./DashboardWidgetShell";
import { getWidgetComponent, getWidgetEntry, renderWidgetProps } from "./registry";
import { EmptyDashboardState } from "./EmptyDashboardState";

interface Props {
  onNavigate?: (tab: Tab) => void;
  selectedId: string | null;
  onSelectWidget: (id: string | null) => void;
  onConfigureWidget: (id: string) => void;
  onAddWidgets?: () => void;
}

export function DashboardGrid({
  onNavigate,
  selectedId,
  onSelectWidget,
  onConfigureWidget,
  onAddWidgets,
}: Props) {
  const widgets = useDashboardLayoutStore((s) => s.widgets);
  const editMode = useDashboardLayoutStore((s) => s.editMode);
  const moveWidget = useDashboardLayoutStore((s) => s.moveWidget);
  const resizeWidget = useDashboardLayoutStore((s) => s.resizeWidget);
  const removeWidget = useDashboardLayoutStore((s) => s.removeWidget);

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; col: number; row: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; colSpan: number; rowSpan: number } | null>(
    null,
  );
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const cellFromPoint = useCallback((clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return { col: 0, row: 0 };
    const rect = el.getBoundingClientRect();
    const colWidth = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    const relX = Math.max(0, clientX - rect.left);
    const relY = Math.max(0, clientY - rect.top);
    const col = Math.min(GRID_COLS - 1, Math.floor(relX / (colWidth + GRID_GAP)));
    const row = Math.max(0, Math.floor(relY / (GRID_ROW_HEIGHT + GRID_GAP)));
    return { col, row };
  }, []);

  const applyPointerUpdate = useCallback(() => {
    rafRef.current = null;
    const point = pointerRef.current;
    if (!point) return;

    if (dragRef.current) {
      const { col, row } = cellFromPoint(point.clientX, point.clientY);
      moveWidget(dragRef.current.id, col, row);
    }
    if (resizeRef.current) {
      const el = gridRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const colWidth = (rect.width - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
      const dx = point.clientX - resizeRef.current.startX;
      const dy = point.clientY - resizeRef.current.startY;
      const dCol = Math.round(dx / (colWidth + GRID_GAP));
      const dRow = Math.round(dy / (GRID_ROW_HEIGHT + GRID_GAP));
      const { id, colSpan, rowSpan } = resizeRef.current;
      resizeWidget(id, colSpan + dCol, rowSpan + dRow);
    }
  }, [cellFromPoint, moveWidget, resizeWidget]);

  const schedulePointerUpdate = useCallback(
    (clientX: number, clientY: number) => {
      pointerRef.current = { clientX, clientY };
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(applyPointerUpdate);
    },
    [applyPointerUpdate],
  );

  const flushPointerUpdate = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    applyPointerUpdate();
    pointerRef.current = null;
  }, [applyPointerUpdate]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current && !resizeRef.current) return;
      schedulePointerUpdate(e.clientX, e.clientY);
    },
    [schedulePointerUpdate],
  );

  const endPointer = useCallback(() => {
    flushPointerUpdate();
    dragRef.current = null;
    resizeRef.current = null;
    setDraggingId(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endPointer);
  }, [flushPointerUpdate, onPointerMove]);

  const startDrag = (id: string, e: React.PointerEvent) => {
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, col: w.col, row: w.row };
    setDraggingId(id);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endPointer);
  };

  const startResize = (id: string, e: React.PointerEvent) => {
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { id, startX: e.clientX, startY: e.clientY, colSpan: w.colSpan, rowSpan: w.rowSpan };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endPointer);
  };

  if (!widgets.length) {
    return <EmptyDashboardState onAddWidgets={onAddWidgets} />;
  }

  return (
    <div
      ref={gridRef}
      className={`pd-grid${editMode ? " pd-grid--edit" : ""}`}
      style={
        {
          "--pd-grid-cols": GRID_COLS,
          "--pd-row-height": `${GRID_ROW_HEIGHT}px`,
          "--pd-grid-gap": `${GRID_GAP}px`,
        } as React.CSSProperties
      }
      onClick={() => editMode && onSelectWidget(null)}
    >
      {widgets.map((inst) => {
        const Component = getWidgetComponent(inst.widgetId);
        const entry = getWidgetEntry(inst.widgetId);
        if (!Component || !entry) return null;
        const props = renderWidgetProps(inst, onNavigate);

        return (
          <div
            key={inst.id}
            className={`pd-grid__item${draggingId === inst.id ? " pd-grid__item--dragging" : ""}`}
            style={{
              gridColumn: `${inst.col + 1} / span ${inst.colSpan}`,
              gridRow: `${inst.row + 1} / span ${inst.rowSpan}`,
            }}
          >
            <DashboardWidgetShell
              instance={inst}
              editMode={editMode}
              selected={selectedId === inst.id}
              onSelect={() => onSelectWidget(inst.id)}
              onRemove={() => removeWidget(inst.id)}
              onConfigure={() => onConfigureWidget(inst.id)}
              onDragStart={(e) => startDrag(inst.id, e)}
              onResizeStart={(e) => startResize(inst.id, e)}
            >
              <Component {...props} />
            </DashboardWidgetShell>
          </div>
        );
      })}
    </div>
  );
}
