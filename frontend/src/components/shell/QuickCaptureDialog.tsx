import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useToastStore } from "../../stores/toastStore";

type CaptureTarget = "daily" | "inbox";

type QuickCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const QuickCaptureDialog = ({ open, onOpenChange }: QuickCaptureDialogProps) => {
  const pushToast = useToastStore((s) => s.push);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<CaptureTarget>("daily");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText("");
    setTarget("daily");
    const t = window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>("[data-quick-capture-input]")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await api.post("/obsidian/capture", { text: trimmed, target });
      pushToast({
        title: "Captured",
        message: target === "daily" ? "Added to today's daily note." : "Appended to inbox file.",
        tone: "success",
      });
      onOpenChange(false);
    } catch {
      pushToast({
        title: "Capture failed",
        message: "Check vault path and API server write access.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="shell-dialog-overlay" />
        <Dialog.Content className="quick-capture-dialog" aria-describedby={undefined}>
          <Dialog.Title className="quick-capture-title">Quick capture</Dialog.Title>
          <p className="quick-capture-hint">Append a timestamped bullet to your vault. Ctrl+Enter to save.</p>

          <fieldset className="quick-capture-targets">
            <label className="quick-capture-target">
              <input
                type="radio"
                name="capture-target"
                checked={target === "daily"}
                onChange={() => setTarget("daily")}
              />
              Daily note
            </label>
            <label className="quick-capture-target">
              <input
                type="radio"
                name="capture-target"
                checked={target === "inbox"}
                onChange={() => setTarget("inbox")}
              />
              Inbox file
            </label>
          </fieldset>

          <textarea
            data-quick-capture-input
            className="quick-capture-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Thought, task, or link…"
            rows={5}
            maxLength={8000}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />

          <div className="quick-capture-actions">
            <button type="button" className="btn-ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={saving || !text.trim()} onClick={() => void submit()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
