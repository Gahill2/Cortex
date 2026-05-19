import { motion } from "framer-motion";
import type { Tab } from "../tab";
import { TAB_SCREEN_TITLES } from "../navigation";
import { cortexIconSrc } from "./brand/assets";

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
      {TAB_SCREEN_TITLES[active]}
    </motion.div>
    <motion.img
      src={cortexIconSrc}
      alt="Cortex"
      className="cortex-logo-img mobile-topbar-logo"
      whileTap={{ scale: 0.92 }}
    />
  </header>
);
