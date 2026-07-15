import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Flame, X, Leaf, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Habit, HabitLog, HabitDayStatus } from "../types";
import { toLocalDateKey } from "../lib/constants";

// Sage & Cream palette (locked design tokens for this module).
const SAGE = {
  bg: "#f5f0e8",
  surface: "#ffffff",
  muted: "#dce5d4",
  mid: "#a8c0a0",
  deep: "#7d9b76",
  deepHover: "#6a8464",
  ink: "#1a2018",
  inkMuted: "#5a6b57",
};

const HABIT_COLORS = [
  "#7d9b76", // deep sage (default)
  "#a8c0a0", // mid sage
  "#c9a84c", // gold
  "#6BA3D6", // sky
  "#D47BC2", // pink
  "#E06B6B", // coral
];

interface HabitTrackerModuleProps {
  habits: Habit[];
  habitLog: HabitLog;
  onAddHabit: (name: string, color: string) => void;
  onDeleteHabit: (id: string) => void;
  onToggleDay: (habitId: string, date: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

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

function dayLetter(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
}
function dayNum(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").getDate().toString();
}
function isToday(dateStr: string): boolean {
  return dateStr === toLocalDateKey();
}

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
  const days = useMemo(() => getLastNDays(isMobile ? 7 : 14), [isMobile]);

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
    onGubbyMessage(`New habit "${trimmed}" added! Even tiny streaks count 🌱`, "excited");
  };

  const getStatus = (habitId: string, date: string): HabitDayStatus =>
    habitLog[`${habitId}:${date}`] || "none";

  const headerFont = { fontFamily: "'Sora', ui-sans-serif, system-ui" };
  const bodyFont = { fontFamily: "'Manrope', ui-sans-serif, system-ui" };

  const addFormBlock = (
    <AnimatePresence mode="wait">
      {showAddForm ? (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="rounded-3xl p-5 sm:p-6 border"
          style={{ backgroundColor: SAGE.surface, borderColor: SAGE.muted }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={selectedColor === c}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: selectedColor === c ? `2px solid ${SAGE.deep}` : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                placeholder="e.g. Drink water, Stretch, Read..."
                autoFocus
                className="flex-1 min-w-0 px-4 py-3 rounded-2xl text-sm border focus:outline-none"
                style={{
                  backgroundColor: SAGE.bg,
                  borderColor: SAGE.muted,
                  color: SAGE.ink,
                  ...bodyFont,
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddHabit}
                  disabled={!newHabitName.trim()}
                  className="flex-1 sm:flex-none px-5 py-3 rounded-2xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                  style={{ backgroundColor: SAGE.deep }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewHabitName(""); }}
                  aria-label="Cancel"
                  className="p-3 rounded-2xl transition-colors"
                  style={{ color: SAGE.inkMuted, backgroundColor: SAGE.bg }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="button"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed py-5 text-sm font-bold transition-colors hover:bg-white/40"
          style={{ borderColor: SAGE.mid, color: SAGE.deep, ...bodyFont }}
        >
          <Plus size={16} />
          New habit
        </motion.button>
      )}
    </AnimatePresence>
  );

  // Empty state
  if (habits.length === 0 && !showAddForm) {
    return (
      <div className="w-full min-h-full pb-24" style={{ backgroundColor: "transparent", ...bodyFont }}>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] p-10 text-center border"
            style={{ backgroundColor: SAGE.surface, borderColor: SAGE.muted }}
          >
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-2xl font-bold mb-2" style={{ ...headerFont, color: SAGE.ink }}>
              Plant your first habit
            </h2>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: SAGE.inkMuted }}>
              Start small — "drink water", "stretch a minute". Consistency grows the chain.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white transition-colors"
              style={{ backgroundColor: SAGE.deep }}
            >
              <Plus size={16} />
              Add your first habit
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24" style={bodyFont}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b"
          style={{ borderColor: SAGE.muted }}
        >
          <div className="min-w-0">
            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight truncate"
              style={{ ...headerFont, color: SAGE.ink }}
            >
              Habit Tracker
            </h1>
            <p
              className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: SAGE.deep }}
            >
              Don't break the chain
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-bold text-sm shadow-md transition-all hover:brightness-110"
            style={{ backgroundColor: SAGE.deep, boxShadow: `0 8px 20px -8px ${SAGE.deep}` }}
          >
            <Plus size={16} className="transition-transform group-hover:rotate-90" />
            Add habit
          </button>
        </motion.header>

        {/* Feed */}
        <div className="space-y-4">
          <AnimatePresence>
            {habits.map((habit) => {
              const { streak, total } = statsByHabit[habit.id] ?? { streak: 0, total: 0 };
              return (
                <motion.article
                  key={habit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="group rounded-[2rem] p-5 sm:p-6 border transition-all hover:-translate-y-0.5"
                  style={{
                    backgroundColor: SAGE.muted,
                    borderColor: `${SAGE.mid}55`,
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="min-w-0 flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{
                          backgroundColor: habit.color,
                          boxShadow: `0 0 0 4px ${habit.color}22`,
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <h2
                          className="text-lg sm:text-xl font-bold truncate"
                          style={{ ...headerFont, color: SAGE.ink }}
                        >
                          {habit.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider"
                            style={{ color: SAGE.deep }}
                            aria-label={`${streak} day streak`}
                          >
                            <Flame size={12} className={streak >= 3 ? "animate-pulse" : ""} aria-hidden />
                            {streak} day{streak === 1 ? "" : "s"}
                          </span>
                          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: SAGE.mid }} aria-hidden />
                          <span
                            className="text-[11px] font-semibold tabular-nums"
                            style={{ color: `${SAGE.ink}99` }}
                          >
                            {total} total
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: habit.id, name: habit.name })}
                      aria-label={`Delete habit ${habit.name}`}
                      className="p-2 rounded-lg transition-colors opacity-60 hover:opacity-100 hover:bg-white/50"
                      style={{ color: SAGE.inkMuted }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 14-day (or 7-day) strip */}
                  <div className="flex justify-between items-end gap-1.5">
                    {days.map((date) => {
                      const status = getStatus(habit.id, date);
                      const today = isToday(date);
                      const done = status === "done";
                      const skip = status === "skip";
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => onToggleDay(habit.id, date)}
                          aria-label={`${habit.name} on ${date} — ${done ? "done" : skip ? "skipped" : "not done"}`}
                          aria-pressed={done}
                          className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group/cell"
                        >
                          <span
                            className="text-[10px] font-bold uppercase leading-none"
                            style={{ color: today ? SAGE.deep : `${SAGE.ink}55` }}
                          >
                            {today ? "Now" : dayLetter(date)}
                          </span>
                          <motion.span
                            whileTap={{ scale: 0.85 }}
                            className="w-full aspect-[3/4] rounded-xl flex items-center justify-center text-white text-[11px] font-bold transition-colors"
                            style={{
                              backgroundColor: done
                                ? habit.color
                                : skip
                                ? "#FEF3C7"
                                : today
                                ? SAGE.surface
                                : `${SAGE.surface}80`,
                              border: today && !done
                                ? `2px solid ${SAGE.deep}`
                                : skip
                                ? "2px dashed #D97706"
                                : done
                                ? "2px solid transparent"
                                : `1px solid ${SAGE.mid}66`,
                              color: done ? "#fff" : skip ? "#D97706" : `${SAGE.ink}88`,
                              boxShadow: done ? `0 2px 6px -2px ${habit.color}88` : "none",
                            }}
                          >
                            {done ? (
                              <Check size={14} strokeWidth={3} aria-hidden />
                            ) : skip ? (
                              <Leaf size={12} aria-hidden />
                            ) : (
                              <span className="tabular-nums">{dayNum(date)}</span>
                            )}
                          </motion.span>
                        </button>
                      );
                    })}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>

          {addFormBlock}
        </div>

        {habits.length > 0 && habits.length < 3 && (
          <p className="text-center text-[11px] px-2" style={{ color: SAGE.inkMuted }}>
            Tap a day to mark done · tap again to skip · once more to clear.
          </p>
        )}
      </div>

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
              className="p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl"
              style={{ backgroundColor: SAGE.surface, border: `1px solid ${SAGE.muted}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="habit-delete-title" className="text-lg font-bold" style={{ ...headerFont, color: SAGE.ink }}>
                Delete this habit?
              </h3>
              <p className="text-sm" style={{ color: SAGE.inkMuted }}>
                "{confirmDelete.name}" and its streak history will be removed. This can't be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                  style={{ border: `2px solid ${SAGE.muted}`, color: SAGE.inkMuted }}
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
                  className="px-4 py-2.5 rounded-xl text-white font-bold text-sm bg-red-500 hover:bg-red-600 transition-colors"
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
