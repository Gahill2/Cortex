import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { GridWidgetInstance } from "./types";
import { getWidgetEntry } from "./registry";
import { useDashboardLayoutStore } from "./state/dashboardLayoutStore";

interface Props {
  instance: GridWidgetInstance | null;
  onClose: () => void;
}

export function WidgetConfigPanel({ instance, onClose }: Props) {
  const updateSettings = useDashboardLayoutStore((s) => s.updateSettings);
  const open = Boolean(instance);
  const entry = instance ? getWidgetEntry(instance.widgetId) : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="pd-panel-overlay" />
        <Dialog.Content className="pd-config" aria-describedby={undefined}>
          <div className="pd-config__head">
            <Dialog.Title className="pd-config__title">{entry?.name ?? "Widget"}</Dialog.Title>
            <Dialog.Close className="pd-config__close" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          {instance && entry ? (
            <div className="pd-config__form">
              {entry.configFields.length === 0 ? (
                <p className="pd-config__empty">No settings for this widget yet.</p>
              ) : (
                entry.configFields.map((field) => {
                  const value = String(instance.settings[field.key] ?? "");
                  if (field.type === "select" && field.options) {
                    return (
                      <label key={field.key} className="pd-config__field">
                        <span>{field.label}</span>
                        <select
                          value={value}
                          onChange={(e) => updateSettings(instance.id, { [field.key]: e.target.value })}
                        >
                          {field.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  return (
                    <label key={field.key} className="pd-config__field">
                      <span>{field.label}</span>
                      <input
                        type="text"
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(e) => updateSettings(instance.id, { [field.key]: e.target.value })}
                      />
                    </label>
                  );
                })
              )}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
