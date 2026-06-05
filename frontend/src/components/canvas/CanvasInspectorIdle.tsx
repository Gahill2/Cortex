/** Shown in the fixed inspector strip when nothing is selected on the canvas. */

interface Props {
  editMode?: boolean;
  onOpenLibrary?: () => void;
}

export function CanvasInspectorIdle({ editMode, onOpenLibrary }: Props) {
  return (
    <div className="canvas-inspector-idle" role="status">
      <span className="canvas-inspector-idle__title">Inspector</span>
      <span className="canvas-inspector-idle__hint">
        {editMode
          ? "Drag widgets to rearrange, use handles to resize, or open the widget library to add modules."
          : "Select a widget to edit position and style, or tap Customize to enter edit mode."}
      </span>
      {onOpenLibrary && (
        <button type="button" className="canvas-inspector-idle__link" onClick={onOpenLibrary}>
          Widget library
        </button>
      )}
    </div>
  );
}
