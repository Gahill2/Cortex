import { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type GlassPanelProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export const GlassPanel = <T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...rest
}: GlassPanelProps<T>) => {
  const Tag = (as ?? "div") as ElementType;
  const classes = ["glass-panel", className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
};
