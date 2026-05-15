import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useEffect } from "react";
export const CommandPalette = ({ open, onOpenChange, actions }) => {
    useEffect(() => {
        if (!open)
            return;
        const t = window.setTimeout(() => {
            const input = document.querySelector("[data-shell-command-input]");
            input?.focus();
        }, 0);
        return () => window.clearTimeout(t);
    }, [open]);
    const grouped = actions.reduce((acc, action) => {
        acc[action.group] ??= [];
        acc[action.group].push(action);
        return acc;
    }, {});
    return (_jsx(Dialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Overlay, { className: "shell-dialog-overlay" }), _jsxs(Dialog.Content, { className: "shell-command-dialog", "aria-describedby": undefined, children: [_jsx(Dialog.Title, { className: "sr-only", children: "Command palette" }), _jsxs(Command, { className: "shell-command-root", label: "Cortex commands", children: [_jsx(Command.Input, { "data-shell-command-input": true, placeholder: "Type a command\u2026", className: "shell-command-input" }), _jsxs(Command.List, { className: "shell-command-list", children: [_jsx(Command.Empty, { className: "shell-command-empty", children: "No matching commands." }), Object.entries(grouped).map(([group, items]) => (_jsx(Command.Group, { heading: group, className: "shell-command-group", children: items.map((item) => (_jsxs(Command.Item, { value: `${item.label} ${item.keywords ?? ""}`, onSelect: () => {
                                                    item.onSelect();
                                                    onOpenChange(false);
                                                }, className: "shell-command-item", children: [_jsx("span", { children: item.label }), item.shortcut ? _jsx("kbd", { className: "shell-kbd", children: item.shortcut }) : null] }, item.id))) }, group)))] })] })] })] }) }));
};
