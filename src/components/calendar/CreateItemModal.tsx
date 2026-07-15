import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check } from "lucide-react";
import { PRIORITY_SOLID } from "../../lib/constants";
import { COLORS, CreateType } from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedDateStr: string;
  createType: CreateType;
  onSetCreateType: (t: CreateType) => void;
  taskTitle: string;
  onSetTaskTitle: (v: string) => void;
  taskPriority: "low" | "medium" | "high";
  onSetTaskPriority: (p: "low" | "medium" | "high") => void;
  eventTitle: string;
  onSetEventTitle: (v: string) => void;
  eventTime: string;
  onSetEventTime: (v: string) => void;
  eventColor: string;
  onSetEventColor: (v: string) => void;
  hasGoogleToken: boolean;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function CreateItemModal(props: Props) {
  const {
    open, onClose, selectedDateStr, createType, onSetCreateType,
    taskTitle, onSetTaskTitle, taskPriority, onSetTaskPriority,
    eventTitle, onSetEventTitle, eventTime, onSetEventTime, eventColor, onSetEventColor,
    hasGoogleToken, isLoading, onSubmit
  } = props;

  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) modalRef.current?.focus(); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-modal-title"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface p-6 rounded-3xl border-2 border-edge max-w-md w-full shadow-2xl space-y-4 outline-none"
          >
            <h3 id="create-modal-title" className="text-xl font-bold text-ink font-fredoka flex items-center gap-2">
              <Plus size={22} className="text-brand" /> Plan for {selectedDateStr}
            </h3>

            <div className="flex bg-surface-sunken p-1 rounded-xl border border-edge-soft">
              <button
                type="button" id="modal-tab-task"
                onClick={() => onSetCreateType("task")}
                className={`flex-1 py-1.5 text-center text-xs font-bold font-fredoka rounded-lg transition-all cursor-pointer ${
                  createType === "task" ? "bg-emerald-600 text-white shadow-xs" : "text-ink-muted hover:text-ink hover:bg-surface"
                }`}
              >
                🎯 Task Quest
              </button>
              <button
                type="button" id="modal-tab-event"
                onClick={() => onSetCreateType("event")}
                className={`flex-1 py-1.5 text-center text-xs font-bold font-fredoka rounded-lg transition-all cursor-pointer ${
                  createType === "event" ? "bg-brand-hover text-white shadow-xs" : "text-ink-muted hover:text-ink hover:bg-surface"
                }`}
              >
                📌 Custom Event
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3.5 font-nunito text-sm">
              {createType === "task" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink-muted uppercase">Task Title:</label>
                    <input
                      id="new-task-title" type="text" required
                      value={taskTitle} onChange={(e) => onSetTaskTitle(e.target.value)}
                      placeholder="E.g., Complete math assignment, gather wood..."
                      className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-emerald-600 font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink-muted uppercase block">Quest Priority:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["low", "medium", "high"] as const).map((lvl) => (
                        <button
                          key={lvl} id={`task-priority-btn-${lvl}`} type="button"
                          onClick={() => onSetTaskPriority(lvl)}
                          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold font-fredoka uppercase transition-all cursor-pointer text-center ${
                            taskPriority === lvl ? PRIORITY_SOLID[lvl] + " shadow-sm" : "bg-surface text-ink-muted border-edge-soft hover:bg-surface-raised"
                          }`}
                        >
                          {lvl === "high" ? "🔴" : lvl === "medium" ? "🟡" : "🟢"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink-muted uppercase">Event Title:</label>
                    <input
                      id="new-event-title" type="text" required
                      value={eventTitle} onChange={(e) => onSetEventTitle(e.target.value)}
                      placeholder="E.g., Doctor appointment, fetch green moss..."
                      className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-ink-muted uppercase">Time (Optional):</label>
                    <input
                      id="new-event-time" type="time"
                      value={eventTime} onChange={(e) => onSetEventTime(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink-muted uppercase">Color Theme:</label>
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c.value} id={`event-color-picker-${c.value}`} type="button"
                          onClick={() => onSetEventColor(c.value)}
                          className={`w-8 h-8 rounded-full border transition-all ${c.value} flex items-center justify-center shrink-0 ${
                            eventColor === c.value ? "ring-2 ring-[#F27D26] scale-105" : "opacity-80"
                          }`}
                          title={c.label}
                        >
                          {eventColor === c.value && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hasGoogleToken && (
                    <div className="bg-sky-50 text-sky-800 text-[11px] font-bold px-3 py-2 rounded-xl border border-sky-100 flex items-center gap-1.5">
                      <span className="text-sm">📅</span>
                      <span>Syncs instantly to your primary Google Calendar!</span>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  id="cancel-create" type="button" onClick={onClose}
                  className="flex-1 py-2.5 bg-surface-raised hover:bg-surface-raised2 text-ink-muted font-bold rounded-xl text-sm cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="save-create" type="submit" disabled={isLoading}
                  className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm cursor-pointer transition-colors ${
                    isLoading ? "opacity-50 cursor-not-allowed" : ""
                  } ${createType === "task" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-brand hover:bg-brand-hover"}`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  ) : createType === "task" ? "Schedule Quest" : hasGoogleToken ? "📅 Sync to Google Calendar" : "Pin Event"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CreateItemModal;
