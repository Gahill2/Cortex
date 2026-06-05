import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WidgetCategory } from "./types";
import { WIDGET_CATEGORY_LABELS } from "./types";
import { WIDGET_REGISTRY } from "./registry";
import { useDashboardLayoutStore } from "./state/dashboardLayoutStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WidgetLibraryPanel({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WidgetCategory | "all">("all");
  const addWidget = useDashboardLayoutStore((s) => s.addWidget);
  const activeIds = useDashboardLayoutStore(useShallow((s) => s.widgets.map((w) => w.widgetId)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WIDGET_REGISTRY.filter((w) => {
      if (category !== "all" && w.category !== category) return false;
      if (!q) return true;
      return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  const categories = useMemo(() => {
    const set = new Set(WIDGET_REGISTRY.map((w) => w.category));
    return ["all" as const, ...Array.from(set)];
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pd-panel-overlay" />
        <Dialog.Content className="pd-library" aria-describedby={undefined}>
          <div className="pd-library__head">
            <div>
              <Dialog.Title className="pd-library__title">Widget library</Dialog.Title>
              <Dialog.Description className="pd-library__desc">
                Add modules to your dashboard — like iOS widgets.
              </Dialog.Description>
            </div>
            <Dialog.Close className="pd-library__close" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="pd-library__search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Search widgets…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pd-library__categories">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? "is-active" : ""}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "All" : WIDGET_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="pd-library__grid">
            {filtered.map((w) => {
              const added = activeIds.includes(w.id);
              return (
                <motion.button
                  key={w.id}
                  type="button"
                  className="pd-library-card"
                  whileHover={{ y: -2 }}
                  onClick={() => {
                    addWidget(w.id);
                  }}
                >
                  <div className="pd-library-card__preview" style={{ background: w.previewGradient }}>
                    <span>{w.icon}</span>
                  </div>
                  <div className="pd-library-card__meta">
                    <strong>{w.name}</strong>
                    <span>{w.description}</span>
                    {added ? <em className="pd-library-card__badge">On board</em> : null}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
