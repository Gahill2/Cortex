import type { Tab } from "../App";
interface Props {
    active: Tab;
    onChange: (tab: Tab) => void;
}
export declare const BottomNav: ({ active, onChange }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
