import type { WidgetRegistryEntry } from "../../dashboard/types";
import { getDefaultWidgetStyle } from "./widgetDefaultStyle";
import type { WidgetRenderStyle } from "./widgetRenderStyle";
import { buildWidgetRenderStyle } from "./widgetRenderStyle";
import { WidgetStylePicker } from "./WidgetStylePicker";
import type { WidgetSkin } from "./widgetSkins";
import type { WidgetSizeVariant } from "./widgetVariants";
import * as Dialog from "@radix-ui/react-dialog";
import { ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardTypography } from "../../lib/uiCustomization";
import { TextSizePresetPicker } from "./TextSizePresetPicker";

export type WidgetInsertPayload = {
  widgetKey: string;
  variant: WidgetSizeVariant;
  skin: WidgetSkin;
  display: string;
  title?: string;
  textSizePx?: number;
  textScale?: number;
};

export type ImageInsertPayload = {
  imageUrl: string;
  w: number;
  h: number;
};

export type WidgetComposerState =
  | { kind: "widget"; entry: WidgetRegistryEntry }
  | { kind: "image"; imageUrl?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: WidgetComposerState | null;
  boardTypography?: BoardTypography;
  renderPreview: (
    widgetKey: string,
    style: WidgetRenderStyle,
    instance?: { title?: string; widgetConfig?: Record<string, unknown> },
  ) => ReactNode;
  onInsertWidget: (payload: WidgetInsertPayload) => void;
  onInsertImage: (payload: ImageInsertPayload) => void;
}

export function WidgetComposerDialog({
  open,
  onOpenChange,
  state,
  boardTypography = { textSizePx: 24, textScale: 1 },
  renderPreview,
  onInsertWidget,
  onInsertImage,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [variant, setVariant] = useState<WidgetSizeVariant>("medium");
  const [skin, setSkin] = useState<WidgetSkin>("ios");
  const [display, setDisplay] = useState("standard");
  const [title, setTitle] = useState("");
  const [textSizePx, setTextSizePx] = useState(boardTypography.textSizePx);
  const [textScale, setTextScale] = useState(boardTypography.textScale);
  const [imageUrl, setImageUrl] = useState("");
  const [imageW, setImageW] = useState(480);
  const [imageH, setImageH] = useState(320);

  useEffect(() => {
    if (!open || !state) return;
    if (state.kind === "widget") {
      const defaults = getDefaultWidgetStyle(state.entry.key);
      setVariant(state.entry.defaultVariant ?? defaults.variant);
      setSkin(state.entry.defaultSkin ?? defaults.skin);
      setDisplay(state.entry.defaultDisplay ?? defaults.display);
      setTitle("");
      setTextSizePx(boardTypography.textSizePx);
      setTextScale(boardTypography.textScale);
    } else {
      setImageUrl(state.imageUrl ?? "");
      setImageW(480);
      setImageH(320);
    }
  }, [open, state, boardTypography.textSizePx, boardTypography.textScale]);

  const widgetKey = state?.kind === "widget" ? state.entry.key : null;
  const style = useMemo(
    () => (widgetKey ? buildWidgetRenderStyle(widgetKey, variant, skin, display) : null),
    [widgetKey, variant, skin, display],
  );

  const preview = useMemo(() => {
    if (!widgetKey || !style) return null;
    const typographyCustom =
      textSizePx !== boardTypography.textSizePx || textScale !== boardTypography.textScale;
    return renderPreview(widgetKey, style, {
      title: title.trim() || undefined,
      widgetConfig: typographyCustom ? { textSizePx, textScale, typographyCustom: true } : undefined,
    });
  }, [widgetKey, style, title, textSizePx, textScale, boardTypography, renderPreview]);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleInsert = () => {
    if (!state) return;
    if (state.kind === "widget" && widgetKey && style) {
      const typographyCustom =
        textSizePx !== boardTypography.textSizePx || textScale !== boardTypography.textScale;
      onInsertWidget({
        widgetKey,
        variant: style.variant,
        skin: style.skin,
        display: style.display,
        title: title.trim() || undefined,
        ...(typographyCustom ? { textSizePx, textScale } : {}),
      });
      onOpenChange(false);
      return;
    }
    if (state.kind === "image" && imageUrl.trim()) {
      onInsertImage({ imageUrl: imageUrl.trim(), w: imageW, h: imageH });
      onOpenChange(false);
    }
  };

  const isWidget = state?.kind === "widget";
  const entry = isWidget ? state.entry : null;
  const canInsert = isWidget ? Boolean(widgetKey) : Boolean(imageUrl.trim());

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="widget-composer__overlay" />
        <Dialog.Content className="widget-composer" onPointerDownOutside={(e) => e.preventDefault()}>
          <header className="widget-composer__header">
            <Dialog.Title className="widget-composer__title">
              {isWidget ? `Add ${entry?.label ?? "widget"}` : "Add image"}
            </Dialog.Title>
            <Dialog.Close className="widget-composer__close" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </header>

          <div className="widget-composer__body-wrap">
            <div className={`widget-composer__body${isWidget ? "" : " widget-composer__body--image"}`}>
              {isWidget ? (
                <div className="widget-composer__preview-frame">{preview}</div>
              ) : (
                <div className="widget-composer__image-stage">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="widget-composer__image-preview" />
                  ) : (
                    <div className="widget-composer__image-placeholder">
                      <ImageIcon size={32} aria-hidden />
                      <p>Paste a URL or upload an image</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isWidget ? (
              <div className="widget-composer__controls">
                <label className="widget-composer__field">
                  <span>Title (optional)</span>
                  <input
                    type="text"
                    value={title}
                    placeholder={entry?.label ?? "Widget title"}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                <div className="widget-composer__text-size">
                  <span className="widget-composer__field-label">Typography</span>
                  <TextSizePresetPicker
                    compact={false}
                    textSizePx={textSizePx}
                    textScale={textScale}
                    onTextSizePxChange={setTextSizePx}
                    onTextScaleChange={setTextScale}
                  />
                </div>

                {widgetKey ? (
                  <WidgetStylePicker
                    variant="panel"
                    widgetKey={widgetKey}
                    size={variant}
                    skin={skin}
                    display={display}
                    onSize={setVariant}
                    onSkin={setSkin}
                    onDisplay={setDisplay}
                  />
                ) : null}
              </div>
            ) : (
              <div className="widget-composer__controls">
                <label className="widget-composer__field">
                  <span>Image URL</span>
                  <input
                    type="url"
                    value={imageUrl}
                    placeholder="https://…"
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </label>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageFile} />
                <button type="button" className="widget-composer__btn" onClick={() => fileRef.current?.click()}>
                  Upload file
                </button>
                <div className="widget-composer__dims">
                  <label className="widget-composer__field">
                    <span>Width</span>
                    <input type="number" min={80} value={imageW} onChange={(e) => setImageW(Number(e.target.value))} />
                  </label>
                  <label className="widget-composer__field">
                    <span>Height</span>
                    <input type="number" min={80} value={imageH} onChange={(e) => setImageH(Number(e.target.value))} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <footer className="widget-composer__footer">
            <button type="button" className="widget-composer__btn" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="widget-composer__btn widget-composer__btn--primary"
              disabled={!canInsert}
              onClick={handleInsert}
            >
              Add to canvas
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
