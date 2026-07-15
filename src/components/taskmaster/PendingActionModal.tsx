import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import type { PendingAction } from "./constants";

interface Props {
  pendingAction: PendingAction | null;
  onConfirm: (action: PendingAction) => void;
  onCancel: () => void;
}

export default function PendingActionModal({ pendingAction, onConfirm, onCancel }: Props) {
  if (!pendingAction) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-canvas/85 backdrop-blur-sm z-50 flex items-center justify-center p-6"
    >
      <div className="max-w-sm w-full bg-surface-sunken border border-edge rounded-2xl p-6 text-center space-y-4">
        <AlertCircle size={24} className="text-warn mx-auto" />
        <h3 className="text-base font-bold text-ink">Reset focus progress?</h3>
        <p className="text-xs text-ink-muted">Loading a new mission will discard your active countdown.</p>
        <div className="flex gap-2">
          <button
            id="confirm-action-yes-btn"
            onClick={() => onConfirm(pendingAction)}
            className="flex-1 h-10 bg-danger text-white font-bold text-xs rounded-lg cursor-pointer"
          >Yes, switch</button>
          <button
            id="confirm-action-no-btn"
            onClick={onCancel}
            className="flex-1 h-10 bg-surface-raised text-ink-muted font-bold text-xs rounded-lg border border-edge cursor-pointer"
          >Keep going</button>
        </div>
      </div>
    </motion.div>
  );
}
