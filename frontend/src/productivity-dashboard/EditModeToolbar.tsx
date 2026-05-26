import { RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  onReset: () => void;
}

export function EditModeToolbar({ visible, onReset }: Props) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="pd-edit-toolbar"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <p>Drag to move · corner to resize · tap a widget to configure</p>
          <button type="button" className="pd-edit-toolbar__reset" onClick={onReset}>
            <RotateCcw size={14} />
            Reset layout
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
