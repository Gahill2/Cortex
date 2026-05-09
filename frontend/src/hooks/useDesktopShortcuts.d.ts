import type { CortexModuleKey } from "../types/moduleKey";
export type DesktopShortcutHandlers = {
    enabled: boolean;
    paletteOpen: boolean;
    expandedModuleOpen: boolean;
    activeModule?: CortexModuleKey;
    onOpenPalette: () => void;
    onClosePalette: () => void;
    onCloseExpanded: () => void;
    onLock: () => void;
    onFocusAiChat?: () => void;
    onRefreshFocused?: () => void;
    navigateModule?: (index: 1 | 2 | 3) => void;
    cycleModule?: (dir: 1 | -1) => void;
    onSelectAllFiles?: () => void;
};
export declare const useDesktopShortcuts: ({ enabled, paletteOpen, expandedModuleOpen, onOpenPalette, onClosePalette, onCloseExpanded, onLock, onFocusAiChat, onRefreshFocused, navigateModule, cycleModule, activeModule, onSelectAllFiles }: DesktopShortcutHandlers) => void;
