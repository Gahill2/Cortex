import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getDefaultWidgetStyle } from "../components/canvas/widgetDefaultStyle";
import { getRegistryByCategory, type WidgetRegistryEntry } from "./widgetRegistry";
import { WIDGET_CATEGORY_LABELS } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Figma-style left dock (edit mode) vs centered modal */
  docked?: boolean;
  /** Opens the configure-before-insert composer for a widget type. */
  onPick: (entry: WidgetRegistryEntry) => void;
  onPickImage: () => void;
}

export function WidgetLibrary({
  open,
  onOpenChange,
  docked = false,
  onPick,
  onPickImage,
}: Props) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => getRegistryByCategory(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (w) =>
            w.label.toLowerCase().includes(q) ||
            w.description.toLowerCase().includes(q) ||
            w.key.includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const handlePick = (entry: WidgetRegistryEntry) => {
    onPick(entry);
    onOpenChange(false);
  };

  const panel = (
    <WidgetLibraryPanel
      query={query}
      onQueryChange={setQuery}
      filtered={filtered}
      onPick={handlePick}
      onPickImage={onPickImage}
      onClose={() => onOpenChange(false)}
      docked={docked}
    />
  );

  if (docked) {
    return (
      <AnimatePresence>
        {open && (
          <motion.aside
            className="widget-library-dock"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            aria-label="Widget library"
          >
            <div className="widget-library widget-library--docked">{panel}</div>
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="widget-library__overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              className="widget-library__shell"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                className="widget-library"
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                {panel}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function WidgetLibraryPanel({
  query,
  onQueryChange,
  filtered,
  onPick,
  onPickImage,
  onClose,
  docked,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  filtered: ReturnType<typeof getRegistryByCategory>;
  onPick: (entry: WidgetRegistryEntry) => void;
  onPickImage: () => void;
  onClose: () => void;
  docked: boolean;
}) {
  const Title = docked ? "h2" : Dialog.Title;
  const Description = docked ? "p" : Dialog.Description;
  const CloseBtn = docked ? "button" : Dialog.Close;

  return (
    <>
      <header className="widget-library__header">
        <div className="widget-library__header-text">
          <Title className="widget-library__title">Add to board</Title>
          <Description className="widget-library__desc">
            Pick a widget or image — configure size and text before it goes on your canvas.
          </Description>
        </div>
        <CloseBtn
          type="button"
          className="widget-library__close"
          aria-label="Close"
          onClick={docked ? onClose : undefined}
        >
          <X size={18} strokeWidth={2} />
        </CloseBtn>
      </header>

      <div className="widget-library__search">
        <Search size={16} strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          placeholder="Search widgets…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus={!docked}
        />
      </div>

      <div className="widget-library__body">
        <section className="widget-library__section">
          <h3 className="widget-library__section-title">Media</h3>
          <div className="widget-library__grid">
            <button type="button" className="widget-library__card" onClick={onPickImage}>
              <div
                className="widget-library__preview widget-library__preview--image"
                style={{
                  background:
                    "linear-gradient(145deg, color-mix(in srgb, var(--accent) 35%, #1a1d28), #12141a)",
                }}
              >
                <ImageIcon size={28} strokeWidth={1.5} aria-hidden />
              </div>
              <div className="widget-library__card-body">
                <div className="widget-library__card-top">
                  <h4>Image</h4>
                  <span className="widget-library__size-pill">UPLOAD</span>
                </div>
                <p>Photos, logos, or artwork on your board</p>
                <span className="widget-library__card-cta">
                  <Plus size={14} strokeWidth={2.5} aria-hidden />
                  Configure
                </span>
              </div>
            </button>
          </div>
        </section>

        {filtered.map(({ category, items }) => (
          <section key={category} className="widget-library__section">
            <h3 className="widget-library__section-title">
              {WIDGET_CATEGORY_LABELS[category]}
            </h3>
            <div className="widget-library__grid">
              {items.map((entry) => (
                <WidgetLibraryCard key={entry.key} entry={entry} onPick={() => onPick(entry)} />
              ))}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="widget-library__empty">No widgets match your search.</p>
        )}
      </div>
    </>
  );
}

function WidgetLibraryCard({
  entry,
  onPick,
}: {
  entry: WidgetRegistryEntry;
  onPick: () => void;
}) {
  const defaults = getDefaultWidgetStyle(entry.key);
  const sizeLabel = entry.defaultVariant ?? defaults.variant;

  return (
    <button type="button" className="widget-library__card" onClick={onPick}>
      <div
        className="widget-library__preview"
        style={{
          background:
            entry.previewGradient ??
            "linear-gradient(145deg, color-mix(in srgb, var(--accent) 55%, #1a1d28), #12141a)",
        }}
      >
        <span className="widget-library__preview-icon" aria-hidden>
          {entry.icon}
        </span>
      </div>
      <div className="widget-library__card-body">
        <div className="widget-library__card-top">
          <h4>{entry.label}</h4>
          <span className="widget-library__size-pill">{sizeLabel.toUpperCase()}</span>
        </div>
        <p>{entry.description}</p>
        <span className="widget-library__card-cta">
          <Plus size={14} strokeWidth={2.5} aria-hidden />
          Configure
        </span>
      </div>
    </button>
  );
}
