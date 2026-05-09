import { ReactNode } from "react";

type StatusChipTone = "success" | "neutral" | "warning";

type StatusChipProps = {
  tone?: StatusChipTone;
  children: ReactNode;
};

export const StatusChip = ({ tone = "neutral", children }: StatusChipProps) => {
  return <span className={`status-chip ${tone}`}>{children}</span>;
};
