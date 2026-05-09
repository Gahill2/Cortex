import { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
type GlassPanelProps<T extends ElementType> = {
    as?: T;
    children: ReactNode;
    className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;
export declare const GlassPanel: <T extends ElementType = "div">({ as, children, className, ...rest }: GlassPanelProps<T>) => import("react/jsx-runtime").JSX.Element;
export {};
