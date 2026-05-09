import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useEffect } from "react";

export type PaletteAction = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  shortcut?: string;
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
};

export const CommandPalette = ({ open, onOpenChange, actions }: CommandPaletteProps) => {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("[data-shell-command-input]");
      input?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const grouped = actions.reduce<Record<string, PaletteAction[]>>((acc, action) => {
    acc[action.group] ??= [];
    acc[action.group].push(action);
    return acc;
  }, {});

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="shell-dialog-overlay" />
        <Dialog.Content className="shell-command-dialog" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command className="shell-command-root" label="Cortex commands">
            <Command.Input data-shell-command-input placeholder="Type a command…" className="shell-command-input" />
            <Command.List className="shell-command-list">
              <Command.Empty className="shell-command-empty">No matching commands.</Command.Empty>
              {Object.entries(grouped).map(([group, items]) => (
                <Command.Group key={group} heading={group} className="shell-command-group">
                  {items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.keywords ?? ""}`}
                      onSelect={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className="shell-command-item"
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? <kbd className="shell-kbd">{item.shortcut}</kbd> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
