export type PaletteAction = {
    id: string;
    label: string;
    group: string;
    keywords?: string;
    shortcut?: string;
    onSelect: () => void;
};
type CommandPaletteProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    actions: PaletteAction[];
};
export declare const CommandPalette: ({ open, onOpenChange, actions }: CommandPaletteProps) => import("react/jsx-runtime").JSX.Element;
export {};
