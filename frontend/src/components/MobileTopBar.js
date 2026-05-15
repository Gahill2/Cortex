import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import cortexFavicon from "../assets/cortex-favicon.png";
const TAB_LABELS = {
    home: "Home",
    tasks: "Tasks",
    ai: "AI",
    memory: "Memory",
    mail: "Mail",
    settings: "Settings",
};
export const MobileTopBar = ({ active, onMenuOpen }) => (_jsxs("header", { className: "mobile-topbar", children: [_jsx("button", { type: "button", className: "mobile-menu-btn", onClick: onMenuOpen, "aria-label": "Open menu", children: _jsx("span", { className: "mobile-menu-icon" }) }), _jsx(motion.div, { className: "mobile-topbar-title", initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.15 }, children: TAB_LABELS[active] }, active), _jsx(motion.img, { src: cortexFavicon, alt: "Cortex", className: "cortex-logo-img mobile-topbar-logo", whileTap: { scale: 0.92 } })] }));
