// TODO: not yet wired up
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useState } from "react";
import type { CortexModuleKey } from "../../types/moduleKey";
import { GlassPanel } from "../ui/GlassPanel";

export type ModuleChromeMeta = {
  label: string;
  subtitle: string;
  headerTitle: string;
};

export type ModuleRenderContext = { ghostInGrid: boolean };

type SortableModuleCardProps = {
  id: CortexModuleKey;
  meta: ModuleChromeMeta;
  activeModule: CortexModuleKey;
  onActiveModule: (id: CortexModuleKey) => void;
  expandedModule: CortexModuleKey | null;
  onExpandedChange: (id: CortexModuleKey | null) => void;
  onMoveStep: (id: CortexModuleKey, dir: -1 | 1) => void;
  onRefreshModule?: (id: CortexModuleKey) => void;
  children: ReactNode;
};

function SortableModuleCard({
  id,
  meta,
  activeModule,
  onActiveModule,
  expandedModule,
  onExpandedChange,
  onMoveStep,
  onRefreshModule,
  children
}: SortableModuleCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : undefined,
    zIndex: isDragging ? 3 : undefined,
    willChange: "transform" as const
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-module-shell">
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div className="context-menu-trigger-wrap">
            <GlassPanel
              as="section"
              className={`widget module-card ${activeModule === id ? "active" : ""}`}
              role="listitem"
              tabIndex={0}
              onFocus={() => onActiveModule(id)}
            >
              <div
                className="module-header"
                onDoubleClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  onExpandedChange(id);
                }}
              >
                <div className="module-header-leading">
                  <button
                    type="button"
                    className="module-drag-handle"
                    ref={setActivatorNodeRef}
                    {...listeners}
                    {...attributes}
                    aria-label={`Drag to reorder ${meta.label}`}
                  >
                    ⠿
                  </button>
                  <div>
                    <h3>{meta.headerTitle}</h3>
                    <p className="module-subtitle">{meta.subtitle}</p>
                  </div>
                </div>
                <div className="module-actions">
                  <button type="button" onClick={() => onMoveStep(id, -1)} aria-label={`Move ${meta.label} up`}>
                    Up
                  </button>
                  <button type="button" onClick={() => onMoveStep(id, 1)} aria-label={`Move ${meta.label} down`}>
                    Down
                  </button>
                </div>
              </div>
              {children}
            </GlassPanel>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="shell-context-content" collisionPadding={12}>
            <ContextMenu.Item className="shell-context-item" onSelect={() => onExpandedChange(id)}>
              Expand module
            </ContextMenu.Item>
            <ContextMenu.Item className="shell-context-item" disabled={expandedModule !== id} onSelect={() => onExpandedChange(null)}>
              Collapse
            </ContextMenu.Item>
            <ContextMenu.Separator className="shell-context-sep" />
            <ContextMenu.Item className="shell-context-item" onSelect={() => onRefreshModule?.(id)}>
              Refresh
            </ContextMenu.Item>
            <ContextMenu.Separator className="shell-context-sep" />
            <ContextMenu.Item className="shell-context-item" onSelect={() => onMoveStep(id, -1)}>
              Move up
            </ContextMenu.Item>
            <ContextMenu.Item className="shell-context-item" onSelect={() => onMoveStep(id, 1)}>
              Move down
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </div>
  );
}

export type DashboardModulesProps = {
  moduleIds: CortexModuleKey[];
  onReorder: (next: CortexModuleKey[]) => void;
  activeModule: CortexModuleKey;
  onActiveModule: (id: CortexModuleKey) => void;
  expandedModule: CortexModuleKey | null;
  onExpandedChange: (id: CortexModuleKey | null) => void;
  onDragActiveChange: (active: boolean) => void;
  metaById: Record<CortexModuleKey, ModuleChromeMeta>;
  onMoveStep: (id: CortexModuleKey, dir: -1 | 1) => void;
  onRefreshModule?: (id: CortexModuleKey) => void;
  renderModule: (id: CortexModuleKey, ctx: ModuleRenderContext) => ReactNode;
};

export function DashboardModules({
  moduleIds,
  onReorder,
  activeModule,
  onActiveModule,
  expandedModule,
  onExpandedChange,
  onDragActiveChange,
  metaById,
  onMoveStep,
  onRefreshModule,
  renderModule
}: DashboardModulesProps) {
  const [dragOverlayId, setDragOverlayId] = useState<CortexModuleKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = (event: DragStartEvent) => {
    setDragOverlayId(event.active.id as CortexModuleKey);
    onDragActiveChange(true);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragOverlayId(null);
    onDragActiveChange(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = moduleIds.indexOf(active.id as CortexModuleKey);
    const newIndex = moduleIds.indexOf(over.id as CortexModuleKey);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(moduleIds, oldIndex, newIndex));
  };

  const onDragCancel = () => {
    setDragOverlayId(null);
    onDragActiveChange(false);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={moduleIds} strategy={rectSortingStrategy}>
          <div className="module-canvas dashboard-grid" role="list" aria-label="Dashboard modules">
            {moduleIds.map((id) => (
              <SortableModuleCard
                key={id}
                id={id}
                meta={metaById[id]}
                activeModule={activeModule}
                onActiveModule={onActiveModule}
                expandedModule={expandedModule}
                onExpandedChange={onExpandedChange}
                onMoveStep={onMoveStep}
                onRefreshModule={onRefreshModule}
              >
                {renderModule(id, { ghostInGrid: expandedModule === id })}
              </SortableModuleCard>
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {dragOverlayId ? (
            <div className="module-drag-overlay-preview glass-panel widget">
              <strong>{metaById[dragOverlayId].label}</strong>
              <span className="subtle">Drop to reorder</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {expandedModule ? (
          <motion.div
            key="module-fs"
            className="module-fs-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="module-fs-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onExpandedChange(null)}
          >
            <motion.div
              className="module-fs-panel glass-panel"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="module-fs-header">
                <div>
                  <p className="eyebrow">Module</p>
                  <h2 id="module-fs-title">{metaById[expandedModule].headerTitle}</h2>
                </div>
                <button type="button" className="ghost-btn" onClick={() => onExpandedChange(null)}>
                  Back to grid
                </button>
              </div>
              <div className="module-fs-body">{renderModule(expandedModule, { ghostInGrid: false })}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
