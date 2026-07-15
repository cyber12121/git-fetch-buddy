import { memo, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Calendar } from "lucide-react";

interface Props {
  open: boolean;
  taskTitle: string | undefined;
  date: string;
  time: string;
  error: string | null;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Scheduling dialog for a task. Focus is moved to the dialog on open;
 * Escape closes it. Purely controlled — all state lives in useMagicTodo.
 */
function ScheduleModalImpl(p: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!p.open) return;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") p.onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [p.open, p.onCancel]);

  return (
    <AnimatePresence>
      {p.open && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface p-6 rounded-2xl border border-edge max-w-md w-full shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-ink font-fredoka flex items-center gap-2">
              <Calendar size={18} className="text-brand" /> Schedule Quest
            </h3>
            <p className="text-sm text-ink-muted">
              "<strong className="text-ink">{p.taskTitle}</strong>"
            </p>
            <div className="space-y-1">
              <label htmlFor="schedule-date-input" className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Date</label>
              <input
                id="schedule-date-input"
                type="date"
                value={p.date}
                onChange={(e) => p.onDateChange(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand font-semibold"
              />
              {p.error && (
                <div className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                  <AlertCircle size={14} /> {p.error}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="schedule-time-input" className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Time (optional)</label>
              <input
                id="schedule-time-input"
                type="time"
                value={p.time}
                onChange={(e) => p.onTimeChange(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand font-semibold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                id="cancel-schedule-btn"
                onClick={p.onCancel}
                className="flex-1 py-2.5 bg-surface-sunken hover:bg-surface-raised text-ink-muted font-bold rounded-xl text-sm cursor-pointer"
              >Cancel</button>
              <button
                id="save-schedule-btn"
                onClick={p.onSave}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-primary-foreground font-bold rounded-xl text-sm cursor-pointer"
              >Lock it in</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default memo(ScheduleModalImpl);
