import type { FocusBlock } from "../types";
import { CATEGORY_COLORS } from "../mockData";

interface Props {
  block: FocusBlock;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${t1} – ${t2}`;
}

export function TimeBlock({ block }: Props) {
  const color = CATEGORY_COLORS[block.category] ?? "#5b8dff";
  return (
    <div className="pd-time-block" style={{ ["--block-color" as string]: color }}>
      <span className="pd-time-block__bar" aria-hidden />
      <div className="pd-time-block__content">
        <p className="pd-time-block__title">{block.title}</p>
        <p className="pd-time-block__time">{fmtRange(block.start, block.end)}</p>
      </div>
    </div>
  );
}
