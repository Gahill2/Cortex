import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getDefaultWidgetStyle } from "../components/canvas/widgetDefaultStyle";
import { getRegistryByCategory, type WidgetRegistryEntry } from "./widgetRegistry";
import { WIDGET_CATEGORY_LABELS } from "./types";
import type { WidgetSizeVariant } from "./types";
import type { WidgetSkin } from "../components/canvas/widgetSkins";

// Grouped categories for tabs
const TAB_GROUPS: { label: string; categories: WidgetRegistryEntry["category"][] }[] = [
  { label: "All", categories: [] },
  { label: "Productivity", categories: ["productivity"] },
  { label: "Info", categories: ["calendar", "analytics"] },
  { label: "Integrations", categories: ["email", "music", "automations"] },
  { label: "System", categories: ["system"] },
];

const SKINS: { value: WidgetSkin; label: string }[] = [
  { value: "ios", label: "iOS" },
  { value: "notion", label: "Notion" },
  { value: "cortex", label: "Cortex" },
  { value: "canva", label: "Canva" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: WidgetRegistryEntry, variant?: WidgetSizeVariant, skin?: WidgetSkin) => void;
}

export function WidgetLibrary({ open, onOpenChange, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const groups = useMemo(() => getRegistryByCategory(), []);

  // Flatten all items for search / tab filtering
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tab = TAB_GROUPS[activeTab]!;

    let items = allItems;
    if (tab.categories.length > 0) {
      items = items.filter((w) => tab.categories.includes(w.category));
    }
    if (q) {
      items = items.filter(
        (w) =>
          w.label.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.key.includes(q),
      );
    }

    // Re-group the filtered items by category in registry order
    const order: WidgetRegistryEntry["category"][] = [
      "productivity", "calendar", "email", "music", "system", "automations", "analytics",
    ];
    const byCat = new Map<WidgetRegistryEntry["category"], WidgetRegistryEntry[]>();
    for (const item of items) {
      const arr = byCat.get(item.category) ?? [];
      arr.push(item);
      byCat.set(item.category, arr);
    }
    return order
      .filter((c) => byCat.has(c))
      .map((c) => ({ category: c, items: byCat.get(c)! }));
  }, [allItems, query, activeTab]);

  const handleAdd = (entry: WidgetRegistryEntry, variant?: WidgetSizeVariant, skin?: WidgetSkin) => {
    onAdd(entry, variant, skin);
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
                      Choose a widget, pick a size and style, then add it to your board.
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

                {/* Category tabs */}
                <div className="widget-library__tabs" role="tablist" aria-label="Widget categories">
                  {TAB_GROUPS.map((tab, i) => (
                    <button
                      key={tab.label}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === i}
                      className={`widget-library__tab${activeTab === i ? " widget-library__tab--active" : ""}`}
                      onClick={() => setActiveTab(i)}
                    >
                      {tab.label}
                    </button>
                  ))}
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
                            onAdd={(variant, skin) => handleAdd(entry, variant, skin)}
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
  onAdd: (variant: WidgetSizeVariant, skin: WidgetSkin) => void;
}) {
  const defaults = getDefaultWidgetStyle(entry.key);
  const [selectedVariant, setSelectedVariant] = useState<WidgetSizeVariant>(
    entry.defaultVariant ?? defaults.variant,
  );
  const [selectedSkin, setSelectedSkin] = useState<WidgetSkin>(
    entry.defaultSkin ?? defaults.skin,
  );

  const sizes = entry.variants.map((v) => v.id);

  return (
    <div className="widget-library__card">
      <button
        type="button"
        className="widget-library__preview"
        style={{
          background:
            entry.previewGradient ??
            "linear-gradient(145deg, color-mix(in srgb, var(--accent) 55%, #1a1d28), #12141a)",
        }}
        onClick={() => onAdd(selectedVariant, selectedSkin)}
        aria-label={`Add ${entry.label} widget`}
      >
        <span className="widget-library__preview-icon" aria-hidden>
          {entry.icon}
        </span>
        <span className="widget-library__preview-cta" aria-hidden>
          <Plus size={14} strokeWidth={2.5} />
          Add
        </span>
      </button>

      <div className="widget-library__card-body">
        <div className="widget-library__card-top">
          <h4>{entry.label}</h4>
        </div>
        <p className="widget-library__card-desc">{entry.description}</p>

        {/* Size selector */}
        <div className="widget-library__selectors">
          <div className="widget-library__selector-group" role="group" aria-label="Size">
            {sizes.map((sz) => (
              <button
                key={sz}
                type="button"
                className={`widget-library__selector-btn${selectedVariant === sz ? " widget-library__selector-btn--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); setSelectedVariant(sz); }}
                aria-pressed={selectedVariant === sz}
                title={sz.charAt(0).toUpperCase() + sz.slice(1)}
              >
                {sz === "small" ? "S" : sz === "medium" ? "M" : "L"}
              </button>
            ))}
          </div>

          {/* Skin selector */}
          <div className="widget-library__selector-group" role="group" aria-label="Style">
            {SKINS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`widget-library__selector-btn widget-library__selector-btn--skin${selectedSkin === value ? " widget-library__selector-btn--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); setSelectedSkin(value); }}
                aria-pressed={selectedSkin === value}
                title={label}
              >
                {label.slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="widget-library__card-cta"
          onClick={() => onAdd(selectedVariant, selectedSkin)}
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden />
          Add to board
        </button>
      </div>
    </div>
  );
}
