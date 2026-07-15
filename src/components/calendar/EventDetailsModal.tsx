import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Trash2, Play } from "lucide-react";
import { CalendarEvent } from "../../types";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onFocus: (evt: CalendarEvent) => void;
}

function EventDetailsModal({ event, onClose, onDelete, onFocus }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (event) modalRef.current?.focus(); }, [event]);

  return (
    <AnimatePresence>
      {event && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-modal-title"
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface p-6 rounded-3xl border-2 border-edge max-w-sm w-full shadow-2xl space-y-4 outline-none"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Quest Details</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${event.color}`}>
                {event.type === "task" ? "To-Do Quest" : event.type === "google" ? "Google Calendar" : "Manual Event"}
              </span>
            </div>

            <div className="space-y-2 font-nunito">
              <h4 id="details-modal-title" className="text-xl font-bold text-ink font-fredoka leading-snug">
                {event.type === "task" ? "🎯 " : event.type === "google" ? "📅 " : "📌 "}{event.title}
              </h4>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <Clock size={12} />
                <span>Date: {event.date} {event.time ? `@ ${event.time}` : ""}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {event.type === "task" && (
                <button
                  id="calendar-focus-task-btn"
                  onClick={() => onFocus(event)}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play size={12} /> Focus in Timer 🎯
                </button>
              )}

              <div className="flex gap-2">
                {(event.type === "manual" || event.type === "google" || event.type === "task") && (
                  <button
                    id="calendar-delete-event-btn"
                    onClick={() => onDelete(event.id)}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> {event.type === "task" ? "Remove Task" : "Remove Event"}
                  </button>
                )}
                <button
                  id="calendar-close-details-btn"
                  onClick={onClose}
                  className="flex-1 py-2 bg-surface-raised hover:bg-surface-raised2 text-ink-muted text-xs font-bold rounded-xl transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default EventDetailsModal;
