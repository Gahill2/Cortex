import { useEffect } from "react";
export const useDesktopShortcuts = ({ enabled, paletteOpen, expandedModuleOpen, onOpenPalette, onClosePalette, onCloseExpanded, onLock, onFocusAiChat, onRefreshFocused, navigateModule, cycleModule, activeModule, onSelectAllFiles }) => {
    useEffect(() => {
        if (!enabled)
            return;
        const onKeyDown = (event) => {
            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            const editable = target?.isContentEditable ||
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                (paletteOpen && tag !== "body");
            const key = event.key;
            if (key === "Escape") {
                if (paletteOpen) {
                    event.preventDefault();
                    onClosePalette();
                    return;
                }
                if (expandedModuleOpen) {
                    event.preventDefault();
                    onCloseExpanded();
                }
                return;
            }
            const ctrlOrMeta = event.ctrlKey || event.metaKey;
            if (ctrlOrMeta && key.toLowerCase() === "k") {
                event.preventDefault();
                if (paletteOpen) {
                    onClosePalette();
                }
                else {
                    onOpenPalette();
                }
                return;
            }
            if (ctrlOrMeta && key.toLowerCase() === "a" && activeModule === "files" && onSelectAllFiles && !editable && !paletteOpen) {
                event.preventDefault();
                onSelectAllFiles();
                return;
            }
            if (ctrlOrMeta && key.toLowerCase() === "l") {
                event.preventDefault();
                void onLock();
                return;
            }
            if (ctrlOrMeta && key === " ") {
                event.preventDefault();
                onFocusAiChat?.();
                return;
            }
            if (key === "F5") {
                if (!editable) {
                    event.preventDefault();
                    onRefreshFocused?.();
                }
                return;
            }
            if (!editable && !paletteOpen && !ctrlOrMeta) {
                if (key === "Tab" && cycleModule) {
                    event.preventDefault();
                    cycleModule(event.shiftKey ? -1 : 1);
                    return;
                }
            }
            if (!editable && !paletteOpen && ctrlOrMeta && /^[1-3]$/.test(key) && navigateModule) {
                event.preventDefault();
                navigateModule(Number(key));
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        enabled,
        paletteOpen,
        expandedModuleOpen,
        onOpenPalette,
        onClosePalette,
        onCloseExpanded,
        onLock,
        onFocusAiChat,
        onRefreshFocused,
        navigateModule,
        cycleModule,
        activeModule,
        onSelectAllFiles
    ]);
};
