import type { Tab } from "../App";
interface Props {
    active: Tab;
    onChange: (tab: Tab) => void;
    mobileOpen?: boolean;
    onClose?: () => void;
}
export declare const Sidebar: ({ active, onChange, mobileOpen, onClose }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
