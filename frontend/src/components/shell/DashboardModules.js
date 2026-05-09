import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { GlassPanel } from "../ui/GlassPanel";
function SortableModuleCard({ id, meta, activeModule, onActiveModule, expandedModule, onExpandedChange, onMoveStep, onRefreshModule, children }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : undefined,
        zIndex: isDragging ? 3 : undefined,
        willChange: "transform"
    };
    return (_jsx("div", { ref: setNodeRef, style: style, className: "sortable-module-shell", children: _jsxs(ContextMenu.Root, { children: [_jsx(ContextMenu.Trigger, { asChild: true, children: _jsx("div", { className: "context-menu-trigger-wrap", children: _jsxs(GlassPanel, { as: "section", className: `widget module-card ${activeModule === id ? "active" : ""}`, role: "listitem", tabIndex: 0, onFocus: () => onActiveModule(id), children: [_jsxs("div", { className: "module-header", onDoubleClick: (event) => {
                                        if (event.target.closest("button"))
                                            return;
                                        onExpandedChange(id);
                                    }, children: [_jsxs("div", { className: "module-header-leading", children: [_jsx("button", { type: "button", className: "module-drag-handle", ref: setActivatorNodeRef, ...listeners, ...attributes, "aria-label": `Drag to reorder ${meta.label}`, children: "\u283F" }), _jsxs("div", { children: [_jsx("h3", { children: meta.headerTitle }), _jsx("p", { className: "module-subtitle", children: meta.subtitle })] })] }), _jsxs("div", { className: "module-actions", children: [_jsx("button", { type: "button", onClick: () => onMoveStep(id, -1), "aria-label": `Move ${meta.label} up`, children: "Up" }), _jsx("button", { type: "button", onClick: () => onMoveStep(id, 1), "aria-label": `Move ${meta.label} down`, children: "Down" })] })] }), children] }) }) }), _jsx(ContextMenu.Portal, { children: _jsxs(ContextMenu.Content, { className: "shell-context-content", collisionPadding: 12, children: [_jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => onExpandedChange(id), children: "Expand module" }), _jsx(ContextMenu.Item, { className: "shell-context-item", disabled: expandedModule !== id, onSelect: () => onExpandedChange(null), children: "Collapse" }), _jsx(ContextMenu.Separator, { className: "shell-context-sep" }), _jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => onRefreshModule?.(id), children: "Refresh" }), _jsx(ContextMenu.Separator, { className: "shell-context-sep" }), _jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => onMoveStep(id, -1), children: "Move up" }), _jsx(ContextMenu.Item, { className: "shell-context-item", onSelect: () => onMoveStep(id, 1), children: "Move down" })] }) })] }) }));
}
export function DashboardModules({ moduleIds, onReorder, activeModule, onActiveModule, expandedModule, onExpandedChange, onDragActiveChange, metaById, onMoveStep, onRefreshModule, renderModule }) {
    const [dragOverlayId, setDragOverlayId] = useState(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const onDragStart = (event) => {
        setDragOverlayId(event.active.id);
        onDragActiveChange(true);
    };
    const onDragEnd = (event) => {
        setDragOverlayId(null);
        onDragActiveChange(false);
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const oldIndex = moduleIds.indexOf(active.id);
        const newIndex = moduleIds.indexOf(over.id);
        if (oldIndex < 0 || newIndex < 0)
            return;
        onReorder(arrayMove(moduleIds, oldIndex, newIndex));
    };
    const onDragCancel = () => {
        setDragOverlayId(null);
        onDragActiveChange(false);
    };
    return (_jsxs(_Fragment, { children: [_jsxs(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragStart: onDragStart, onDragEnd: onDragEnd, onDragCancel: onDragCancel, children: [_jsx(SortableContext, { items: moduleIds, strategy: rectSortingStrategy, children: _jsx("div", { className: "module-canvas dashboard-grid", role: "list", "aria-label": "Dashboard modules", children: moduleIds.map((id) => (_jsx(SortableModuleCard, { id: id, meta: metaById[id], activeModule: activeModule, onActiveModule: onActiveModule, expandedModule: expandedModule, onExpandedChange: onExpandedChange, onMoveStep: onMoveStep, onRefreshModule: onRefreshModule, children: renderModule(id, { ghostInGrid: expandedModule === id }) }, id))) }) }), _jsx(DragOverlay, { dropAnimation: null, children: dragOverlayId ? (_jsxs("div", { className: "module-drag-overlay-preview glass-panel widget", children: [_jsx("strong", { children: metaById[dragOverlayId].label }), _jsx("span", { className: "subtle", children: "Drop to reorder" })] })) : null })] }), _jsx(AnimatePresence, { children: expandedModule ? (_jsx(motion.div, { className: "module-fs-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "module-fs-title", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 }, onClick: () => onExpandedChange(null), children: _jsxs(motion.div, { className: "module-fs-panel glass-panel", initial: { opacity: 0, scale: 0.96, y: 16 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 12 }, transition: { type: "spring", stiffness: 380, damping: 32 }, onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "module-fs-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Module" }), _jsx("h2", { id: "module-fs-title", children: metaById[expandedModule].headerTitle })] }), _jsx("button", { type: "button", className: "ghost-btn", onClick: () => onExpandedChange(null), children: "Back to grid" })] }), _jsx("div", { className: "module-fs-body", children: renderModule(expandedModule, { ghostInGrid: false }) })] }) }, "module-fs")) : null })] }));
}
