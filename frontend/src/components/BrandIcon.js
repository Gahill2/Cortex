import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BrandIcon({ icon, className }) {
    return (_jsxs("svg", { className: className, role: "img", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", "aria-label": icon.title, children: [_jsx("title", { children: icon.title }), _jsx("path", { d: icon.path, fill: `#${icon.hex}` })] }));
}
