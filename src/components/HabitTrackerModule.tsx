import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Flame, X, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Habit, HabitLog, HabitDayStatus } from "../types";
import { toLocalDateKey } from "../lib/constants";

// Goblin-friendly color palette for habits
const HABIT_COLORS = [
  "#F27D26", // goblin orange
  "#7CB47C", // sage green
  "#6BA3D6", // sky blue
  "#D47BC2", // lavender pink
  "#E8B44A", // warm gold
  "#E06B6B", // soft coral
];


interface HabitTrackerModuleProps {
  habits: Habit[];
  habitLog: HabitLog;
  onAddHabit: (name: string, color: string) => void;
  onDeleteHabit: (id: string) => void;
  onToggleDay: (habitId: string, date: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

/** Generate an array of date strings for the last N days ending today. */
function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(toLocalDateKey(d));
  }
  return days;
}

/** Short day label: "Mon", "Tue", etc. */
function dayLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

/** Day number: "7", "11", etc. */
function dayNum(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").getDate().toString();
}

/** Month label for the first day or when month changes: "Jul" */
function monthLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
}

/** Check if a date is today */
function isToday(dateStr: string): boolean {
  return dateStr === toLocalDateKey();
}

/** Track whether the viewport is narrower than a breakpoint (mobile-first). */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}

/** Compute streak + total in one pass to avoid O(N*log) per render. */
function computeStats(habitId: string, log: HabitLog): { streak: number; total: number } {
  let total = 0;
  const prefix = `${habitId}:`;
  for (const [key, status] of Object.entries(log)) {
    if (key.startsWith(prefix) && status === "done") total++;
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const status = log[`${prefix}${toLocalDateKey(d)}`];
    if (status === "done") streak++;
    else if (status === "skip") continue;
    else break;
  }
  return { streak, total };
}

export default function HabitTrackerModule({
  habits,
  habitLog,
  onAddHabit,
  onDeleteHabit,
  onToggleDay,
  onGubbyMessage,
}: HabitTrackerModuleProps) {
  const [newHabitName, setNewHabitName] = useState("");
  const [selectedColor, setSelectedColor] = useState(HABIT_COLORS[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const isMobile = useIsMobile();

  // Show fewer days on mobile so cells stay tappable without horizontal scroll pain.
  const days = useMemo(() => getLastNDays(isMobile ? 7 : 14), [isMobile]);

  // Memoize per-habit stats so typing in the add-input doesn't recompute streaks.
  const statsByHabit = useMemo(() => {
    const map: Record<string, { streak: number; total: number }> = {};
    for (const h of habits) map[h.id] = computeStats(h.id, habitLog);
    return map;
  }, [habits, habitLog]);

  const handleAddHabit = () => {
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    onAddHabit(trimmed, selectedColor);
    setNewHabitName("");
    setSelectedColor(HABIT_COLORS[(habits.length + 1) % HABIT_COLORS.length]);
    setShowAddForm(false);
    onGubbyMessage(`New habit "${trimmed}" added! Remember, even tiny streaks count 🌱`, "excited");
  };

  const getStatus = (habitId: string, date: string): HabitDayStatus => {
    return habitLog[`${habitId}:${date}`] || "none";
  };

  // Empty state
  if (habits.length === 0 && !showAddForm) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface/80 backdrop-blur-sm rounded-2xl p-8 sm:p-10 text-center card-shadow"
        >
          <div className="text-5xl mb-4">🍄</div>
          <h2 className="text-xl font-bold text-ink mb-2 font-fredoka">No habits yet!</h2>
          <p className="text-ink-muted text-sm mb-6 max-w-sm mx-auto">
            Start small — even "drink water" or "stretch for 1 minute" counts. Gubby believes in you!
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-6 min-h-11 bg-brand text-white rounded-xl font-bold text-sm hover:bg-brand-hover transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Your First Habit
          </button>
        </motion.div>
      </div>
    );
  }

  // Shared "add habit" form — used by both mobile card view and desktop table.
  const addHabitForm = (
    <div className="border-t border-edge/40 px-3 sm:px-4 py-3">
      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Color picker */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    aria-label={`Choose color ${c}`}
                    aria-pressed={selectedColor === c}
                    className={`w-7 h-7 sm:w-5 sm:h-5 rounded-full transition-all cursor-pointer ${selectedColor === c ? "ring-2 ring-offset-1 ring-[#1A261A]/30 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Name input */}
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                placeholder="e.g. Drink water, Stretch, Read..."
                className="w-full min-w-0 flex-1 px-3 min-h-11 sm:min-h-0 sm:py-2 text-sm bg-surface-sunken border border-edge-soft rounded-xl focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-[#F27D26]/20 text-ink placeholder:text-ink-muted"
                autoFocus
              />

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleAddHabit}
                  disabled={!newHabitName.trim()}
                  className="flex-1 sm:flex-none px-4 min-h-11 sm:min-h-0 sm:py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewHabitName(""); }}
                  aria-label="Cancel adding habit"
                  className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:p-2 grid place-items-center rounded-lg hover:bg-surface/30 text-ink-muted transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-brand transition-colors font-semibold cursor-pointer min-h-11 px-1"
          >
            <Plus size={14} />
            New Habit
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24">
      {/* Header — grid on mobile so the pill can't shove the title */}
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap"
      >
        <h2 className="min-w-0 truncate text-lg font-bold text-ink font-fredoka flex items-center gap-2">
          <span aria-hidden>🌱</span>
          <span className="truncate">Habit Tracker</span>
        </h2>
        <span className="shrink-0 text-[11px] sm:text-xs font-normal text-ink-muted bg-surface/50 px-2 py-1 rounded-full whitespace-nowrap">
          Don't break the chain!
        </span>
      </motion.header>

      {/* MOBILE: card-per-habit view */}
      <div className="sm:hidden space-y-3">
        <AnimatePresence>
          {habits.map((habit) => {
            const { streak, total } = statsByHabit[habit.id] ?? { streak: 0, total: 0 };
            return (
              <motion.article
                key={habit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12, height: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-surface/80 backdrop-blur-sm rounded-2xl card-shadow p-3"
              >
                {/* Card header */}
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: habit.color }}
                    />
                    <h3 className="truncate text-sm font-bold text-ink">{habit.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center gap-0.5 text-xs font-bold text-brand"
                      aria-label={`${streak} day streak`}
                    >
                      {streak > 0 && <Flame size={12} className="text-orange-400" aria-hidden />}
                      {streak}
                    </span>
                    <span
                      className="text-[11px] font-semibold text-ink-muted tabular-nums"
                      aria-label={`${total} total completions`}
                    >
                      · {total}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: habit.id, name: habit.name })}
                      aria-label={`Delete habit ${habit.name}`}
                      className="min-h-11 min-w-11 grid place-items-center rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </header>

                {/* 7-day row — evenly spaced, big tap targets */}
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((date) => {
                    const status = getStatus(habit.id, date);
                    const today = isToday(date);
                    return (
                      <button
                        key={date}
                        onClick={() => onToggleDay(habit.id, date)}
                        aria-label={`${habit.name} on ${dayLabel(date)} ${dayNum(date)} — ${status === "done" ? "done" : status === "skip" ? "skipped" : "not done"}`}
                        aria-pressed={status === "done"}
                        className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${today ? "bg-brand/8" : ""}`}
                      >
                        <span className={`text-[10px] font-semibold ${today ? "text-brand" : "text-ink-muted"}`}>
                          {dayLabel(date).slice(0, 1)}
                        </span>
                        <motion.span
                          whileTap={{ scale: 0.85 }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{
                            backgroundColor: status === "done" ? habit.color : status === "skip" ? "#FEF3C7" : "transparent",
                            border: status === "none" ? "2px solid #CDE0CD" : status === "skip" ? "2px dashed #D97706" : "2px solid transparent",
                          }}
                        >
                          {status === "done" && (
                            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {status === "skip" && <Leaf size={14} className="text-[#D97706] fill-[#FBBF24]/20" aria-hidden />}
                        </motion.span>
                        <span className={`text-[10px] tabular-nums ${today ? "text-brand font-bold" : "text-ink-muted"}`}>
                          {dayNum(date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>

        {/* Add-habit card on mobile */}
        <div className="bg-surface/80 backdrop-blur-sm rounded-2xl card-shadow">
          {addHabitForm}
        </div>
      </div>

      {/* DESKTOP / TABLET: table view (unchanged behavior, tighter mobile handling above) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="hidden sm:block bg-surface/80 backdrop-blur-sm rounded-2xl card-shadow"
      >
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full border-collapse min-w-[660px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface/95 backdrop-blur-sm px-4 py-3 text-left min-w-[160px]">
                  <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Habit</span>
                </th>
                {days.map((date, i) => {
                  const showMonth = i === 0 || monthLabel(date) !== monthLabel(days[i - 1]);
                  return (
                    <th key={date} className={`px-1 py-2 text-center min-w-[44px] ${isToday(date) ? "bg-brand/8" : ""}`}>
                      {showMonth ? (
                        <div className="text-[9px] font-bold text-brand uppercase tracking-wider mb-0.5">
                          {monthLabel(date)}
                        </div>
                      ) : (
                        <div className="h-[13px]" />
                      )}
                      <div className={`text-xs font-bold ${isToday(date) ? "text-brand" : "text-ink"}`}>
                        {dayNum(date)}
                      </div>
                      <div className={`text-[10px] ${isToday(date) ? "text-brand/70" : "text-ink-muted"}`}>
                        {dayLabel(date)}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center min-w-[50px]">
                  <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider" aria-hidden>🔥</div>
                  <div className="text-[9px] text-ink-muted">Streak</div>
                </th>
                <th className="px-3 py-2 text-center min-w-[50px]">
                  <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider" aria-hidden>∑</div>
                  <div className="text-[9px] text-ink-muted">Total</div>
                </th>
              </tr>
            </thead>

            <tbody>
              <AnimatePresence>
                {habits.map((habit) => {
                  const { streak, total } = statsByHabit[habit.id] ?? { streak: 0, total: 0 };
                  return (
                    <motion.tr
                      key={habit.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-edge/40 group"
                    >
                      <td className="sticky left-0 z-10 bg-surface/95 backdrop-blur-sm px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: habit.color }}
                          />
                          <span className="text-sm font-semibold text-ink truncate max-w-[120px]">
                            {habit.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ id: habit.id, name: habit.name })}
                            className="ml-auto p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-red-50 text-ink-muted hover:text-red-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-all cursor-pointer"
                            aria-label={`Delete habit ${habit.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>

                      {days.map((date) => {
                        const status = getStatus(habit.id, date);
                        return (
                          <td
                            key={date}
                            className={`px-1 py-2 text-center relative group ${isToday(date) ? "bg-brand/5" : ""}`}
                          >
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => onToggleDay(habit.id, date)}
                              aria-label={`${habit.name} on ${date} — ${status === "done" ? "done" : status === "skip" ? "skipped" : "not done"}`}
                              aria-pressed={status === "done"}
                              className="w-[36px] h-[36px] rounded-xl mx-auto flex items-center justify-center transition-all duration-150 cursor-pointer relative overflow-visible"
                              style={{
                                backgroundColor: status === "done" ? habit.color : status === "skip" ? "#FEF3C7" : "transparent",
                                border: status === "none" ? "2px solid #CDE0CD" : status === "skip" ? "2px dashed #D97706" : "2px solid transparent",
                              }}
                            >
                              {status === "done" && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </motion.div>
                              )}
                              {status === "skip" && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <Leaf size={14} className="text-[#D97706] fill-[#FBBF24]/20" aria-hidden />
                                </motion.div>
                              )}
                            </motion.button>
                          </td>
                        );
                      })}

                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {streak > 0 && <Flame size={11} className="text-orange-400" aria-hidden />}
                          <span className={`text-xs font-bold ${streak > 0 ? "text-brand" : "text-ink-muted"}`}>
                            {streak}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-bold text-ink-muted">{total}</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>

              {habits.length > 0 && (
                <tr className="border-t-2 border-edge/60">
                  <td className="sticky left-0 z-10 bg-surface/95 backdrop-blur-sm px-4 py-2">
                    <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Daily</span>
                  </td>
                  {days.map((date) => {
                    const doneCount = habits.filter(h => getStatus(h.id, date) === "done").length;
                    const allDone = doneCount === habits.length && habits.length > 0;
                    return (
                      <td key={date} className={`px-1 py-2 text-center ${isToday(date) ? "bg-brand/5" : ""}`}>
                        <span className={`text-[10px] font-bold ${allDone ? "text-brand" : "text-ink-muted"}`}>
                          {doneCount > 0 ? doneCount : "·"}
                        </span>
                      </td>
                    );
                  })}
                  <td /><td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {addHabitForm}
      </motion.div>

      {/* Tip */}
      {habits.length > 0 && habits.length < 3 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-[11px] text-ink-muted mt-4 px-2"
        >
          💡 Tap a day to mark done · Tap again to skip · Tap again to clear
        </motion.p>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="habit-delete-title"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-5 sm:p-6 rounded-3xl border-2 border-edge max-w-sm w-full shadow-2xl space-y-4 outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="habit-delete-title" className="text-lg font-bold text-ink font-fredoka">
                Delete this habit?
              </h3>
              <p className="text-sm text-ink-muted">
                "{confirmDelete.name}" and its streak history will be removed. This can't be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 min-h-11 rounded-xl border-2 border-edge text-ink-muted font-bold text-sm hover:bg-surface-raised transition-colors cursor-pointer"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteHabit(confirmDelete.id);
                    onGubbyMessage("Habit removed. No worries — you can always start fresh! 🌿", "cozy");
                    setConfirmDelete(null);
                  }}
                  className="px-4 min-h-11 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Delete habit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
