import type { ReactNode } from "react";
import type { CortexModuleKey } from "../../types/moduleKey";
export type ModuleChromeMeta = {
    label: string;
    subtitle: string;
    headerTitle: string;
};
export type ModuleRenderContext = {
    ghostInGrid: boolean;
};
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
export declare function DashboardModules({ moduleIds, onReorder, activeModule, onActiveModule, expandedModule, onExpandedChange, onDragActiveChange, metaById, onMoveStep, onRefreshModule, renderModule }: DashboardModulesProps): import("react/jsx-runtime").JSX.Element;
