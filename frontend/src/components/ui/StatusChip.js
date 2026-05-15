import { jsx as _jsx } from "react/jsx-runtime";
export const StatusChip = ({ tone = "neutral", children }) => {
    return _jsx("span", { className: `status-chip ${tone}`, children: children });
};
