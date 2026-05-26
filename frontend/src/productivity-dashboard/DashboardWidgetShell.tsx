import { GripVertical, Settings2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { GridWidgetInstance } from "./types";
import { getWidgetEntry } from "./registry";

interface Props {
  instance: GridWidgetInstance;
  editMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onConfigure: () => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  children: ReactNode;
}

const HERO_IDS = new Set(["today-overview"]);

export function DashboardWidgetShell({
  instance,
  editMode,
  selected,
  onSelect,
  onRemove,
  onConfigure,
  onResizeStart,
  onDragStart,
  children,
}: Props) {
  const entry = getWidgetEntry(instance.widgetId);
  const title = (instance.settings.title as string) || entry?.name || "Widget";
  const isHero = HERO_IDS.has(instance.widgetId);
  const showViewHead = !editMode && !isHero && entry;

  return (
    <article
      data-widget-id={instance.widgetId}
      data-category={entry?.category}
      className={`pd-widget-shell${editMode ? " pd-widget-shell--edit" : ""}${selected ? " pd-widget-shell--selected" : ""}${isHero ? " pd-widget-shell--hero" : ""}`}
      onClick={(e) => {
        if (editMode) {
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      {editMode ? (
        <div className="pd-widget-shell__chrome">
          <button
            type="button"
            className="pd-widget-shell__drag"
            aria-label="Drag widget"
            onPointerDown={onDragStart}
          >
            <GripVertical size={15} strokeWidth={2} />
          </button>
          <span className="pd-widget-shell__chrome-label">{title}</span>
          <div className="pd-widget-shell__actions">
            <button
              type="button"
              aria-label="Configure"
              onClick={(e) => {
                e.stopPropagation();
                onConfigure();
              }}
            >
              <Settings2 size={15} strokeWidth={2} />
            </button>
            <button type="button" aria-label="Remove" onClick={onRemove}>
              <Trash2 size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
      {showViewHead ? (
        <header className="pd-widget-shell__view-head">
          <span className="pd-widget-shell__view-icon" aria-hidden>
            {entry.icon}
          </span>
          <span className="pd-widget-shell__view-title">{title}</span>
        </header>
      ) : null}
      <div className={`pd-widget-shell__body${showViewHead ? " pd-widget-shell__body--headed" : ""}`}>{children}</div>
      {editMode ? (
        <>
          <span className="pd-widget-shell__resize-br" aria-hidden />
          <button
            type="button"
            className="pd-widget-shell__resize"
            aria-label="Resize widget"
            onPointerDown={onResizeStart}
          />
        </>
      ) : null}
    </article>
  );
}
