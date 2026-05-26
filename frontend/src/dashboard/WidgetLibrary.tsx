import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getDefaultWidgetStyle } from "../components/canvas/widgetDefaultStyle";
import { getRegistryByCategory, type WidgetRegistryEntry } from "./widgetRegistry";
import { WIDGET_CATEGORY_LABELS } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: WidgetRegistryEntry) => void;
}

export function WidgetLibrary({ open, onOpenChange, onAdd }: Props) {
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

  const handleAdd = (entry: WidgetRegistryEntry) => {
    onAdd(entry);
    onOpenChange(false);
  };

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
                  <header className="widget-library__header">
                    <div className="widget-library__header-text">
                      <Dialog.Title className="widget-library__title">Widget library</Dialog.Title>
                      <Dialog.Description className="widget-library__desc">
                        Tap a card to add it to your board. Resize and style after you place it.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className="widget-library__close" aria-label="Close">
                      <X size={18} strokeWidth={2} />
                    </Dialog.Close>
                  </header>

                  <div className="widget-library__search">
                    <Search size={16} strokeWidth={1.75} aria-hidden />
                    <input
                      type="search"
                      placeholder="Search widgets…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="widget-library__body">
                    {filtered.map(({ category, items }) => (
                      <section key={category} className="widget-library__section">
                        <h3 className="widget-library__section-title">
                          {WIDGET_CATEGORY_LABELS[category]}
                        </h3>
                        <div className="widget-library__grid">
                          {items.map((entry) => (
                            <WidgetLibraryCard
                              key={entry.key}
                              entry={entry}
                              onAdd={() => handleAdd(entry)}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                    {filtered.length === 0 && (
                      <p className="widget-library__empty">No widgets match your search.</p>
                    )}
                  </div>
                </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function WidgetLibraryCard({
  entry,
  onAdd,
}: {
  entry: WidgetRegistryEntry;
  onAdd: () => void;
}) {
  const defaults = getDefaultWidgetStyle(entry.key);
  const sizeLabel = entry.defaultVariant ?? defaults.variant;

  return (
    <button type="button" className="widget-library__card" onClick={onAdd}>
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
          Add to board
        </span>
      </div>
    </button>
  );
}
