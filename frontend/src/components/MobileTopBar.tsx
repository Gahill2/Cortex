import { motion } from "framer-motion";
import type { Tab } from "../App";
import cortexFavicon from "../assets/cortex-favicon.png";

const TAB_LABELS: Record<Tab, string> = {
  home: "Home",
  tasks: "Tasks",
  ai: "AI",
  memory: "Memory",
  mail: "Mail",
  settings: "Settings",
};

interface Props {
  active: Tab;
  onMenuOpen: () => void;
}

export const MobileTopBar = ({ active, onMenuOpen }: Props) => (
  <header className="mobile-topbar">
    <button type="button" className="mobile-menu-btn" onClick={onMenuOpen} aria-label="Open menu">
      <span className="mobile-menu-icon" />
    </button>
    <motion.div
      key={active}
      className="mobile-topbar-title"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {TAB_LABELS[active]}
    </motion.div>
    <motion.img
      src={cortexFavicon}
      alt="Cortex"
      className="cortex-logo-img mobile-topbar-logo"
      whileTap={{ scale: 0.92 }}
    />
  </header>
);
