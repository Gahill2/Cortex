import { jsx as _jsx } from "react/jsx-runtime";
export const GlassPanel = ({ as, children, className = "", ...rest }) => {
    const Tag = (as ?? "div");
    const classes = ["glass-panel", className].filter(Boolean).join(" ");
    return (_jsx(Tag, { className: classes, ...rest, children: children }));
};
