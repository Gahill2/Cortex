import type { WidgetRenderProps } from "../types";
import { mockNotes } from "../mockData";

export function NotesWidget(_props: WidgetRenderProps) {
  const note = mockNotes.find((n) => n.pinned) ?? mockNotes[0];
  return (
    <div className="pd-widget pd-widget--notes pd-notes">
      <p className="pd-notes__label">Pinned</p>
      <h4>{note?.title}</h4>
      <p className="pd-notes__preview">{note?.preview}</p>
    </div>
  );
}
