import { ReactNode } from "react";
type StatusChipTone = "success" | "neutral" | "warning";
type StatusChipProps = {
    tone?: StatusChipTone;
    children: ReactNode;
};
export declare const StatusChip: ({ tone, children }: StatusChipProps) => import("react/jsx-runtime").JSX.Element;
export {};
