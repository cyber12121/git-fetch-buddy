import { useState, useMemo } from "react";
import { Plus, Trash2, Flame, X, Check, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Habit, HabitLog, HabitDayStatus } from "../types";
import { toLocalDateKey } from "../lib/constants";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const BODY = "'Work Sans', system-ui, sans-serif";

// Habit accent colors — kept vivid, theme-agnostic dots.
const HABIT_COLORS = [
  "#F27D26", "#7CB47C", "#6BA3D6", "#D47BC2", "#E8B44A", "#E06B6B",
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
function todayLongLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function computeStats(habitId: string, log: HabitLog): { streak: number; total: number; weekDone: number } {
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
  let weekDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (log[`${prefix}${toLocalDateKey(d)}`] === "done") weekDone++;
  }
  return { streak, total, weekDone };
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const days = useMemo(() => getLastNDays(7), []);
  const today = toLocalDateKey();

  const statsByHabit = useMemo(() => {
    const map: Record<string, { streak: number; total: number; weekDone: number }> = {};
    for (const h of habits) map[h.id] = computeStats(h.id, habitLog);
    return map;
  }, [habits, habitLog]);

  const summary = useMemo(() => {
    const doneToday = habits.filter(h => habitLog[`${h.id}:${today}`] === "done").length;
    const bestStreak = habits.reduce((m, h) => Math.max(m, statsByHabit[h.id]?.streak ?? 0), 0);
    const weekTotal = habits.reduce((s, h) => s + (statsByHabit[h.id]?.weekDone ?? 0), 0);
    return { doneToday, total: habits.length, bestStreak, weekTotal };
  }, [habits, habitLog, statsByHabit, today]);

  const getStatus = (habitId: string, date: string): HabitDayStatus => {
    return habitLog[`${habitId}:${date}`] || "none";
  };

  const handleAddHabit = () => {
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    onAddHabit(trimmed, selectedColor);
    setNewHabitName("");
    setSelectedColor(HABIT_COLORS[(habits.length + 1) % HABIT_COLORS.length]);
    setShowAddForm(false);
    onGubbyMessage(`New habit "${trimmed}" added. One row, one focus. 🌱`, "excited");
  };

  // Empty state
  if (habits.length === 0 && !showAddForm) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16" style={{ fontFamily: BODY }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted mb-3" style={{ fontFamily: MONO }}>
          habits · {todayLongLabel()}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink leading-tight mb-3">
          Start with <span className="text-brand">one</span>.
        </h1>
        <p className="text-ink-muted text-base mb-8 max-w-md">
          One habit. One row. Tap once a day. That's the whole system.
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-5 h-12 bg-brand text-primary-foreground rounded-full font-bold text-sm hover:bg-brand-hover transition-colors cursor-pointer"
          style={{ boxShadow: "var(--theme-glow)" }}
        >
          <Plus size={16} />
          Add your first habit
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24" style={{ fontFamily: BODY }}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div
          className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted mb-2"
          style={{ fontFamily: MONO }}
        >
          habits · {todayLongLabel()}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight">
          {summary.doneToday === summary.total && summary.total > 0
            ? "All done today. Rest well."
            : summary.doneToday === 0
            ? "One tap at a time."
            : `${summary.doneToday} of ${summary.total} down today.`}
        </h1>
      </motion.header>

      {/* Stats strip — quiet, mono */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 border-y border-edge mb-8"
        style={{ fontFamily: MONO }}
      >
        {[
          { label: "today", value: `${summary.doneToday}/${summary.total || 0}` },
          { label: "best streak", value: `${summary.bestStreak}d` },
          { label: "this week", value: `${summary.weekTotal}` },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`py-4 text-center ${i < 2 ? "border-r border-edge" : ""}`}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-ink-muted">
              {s.label}
            </div>
            <div className="text-2xl font-bold text-ink tabular-nums mt-1">{s.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Feed — one habit per row */}
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {habits.map((habit) => {
            const stats = statsByHabit[habit.id] ?? { streak: 0, total: 0, weekDone: 0 };
            const todayStatus = getStatus(habit.id, today);
            const doneToday = todayStatus === "done";
            const isMenuOpen = openMenu === habit.id;

            return (
              <motion.li
                key={habit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="relative bg-surface border border-edge rounded-2xl overflow-hidden group hover:border-edge-strong transition-colors"
              >
                <div className="flex items-center gap-3 sm:gap-4 p-4">
                  {/* BIG tap-today button — the primary action */}
                  <button
                    onClick={() => onToggleDay(habit.id, today)}
                    aria-label={`Mark ${habit.name} ${doneToday ? "not done" : "done"} today`}
                    aria-pressed={doneToday}
                    className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    style={{
                      backgroundColor: doneToday ? habit.color : "transparent",
                      border: doneToday ? `2px solid ${habit.color}` : `2px solid var(--edge)`,
                      boxShadow: doneToday ? `0 6px 24px -8px ${habit.color}80` : "none",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {doneToday ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <Check size={22} className="text-white" strokeWidth={3} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="dot"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: habit.color, opacity: 0.5 }}
                        />
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Name + streak */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-ink">
                        {habit.name}
                      </h3>
                      {stats.streak > 0 && (
                        <span
                          className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold text-brand"
                          style={{ fontFamily: MONO }}
                          aria-label={`${stats.streak} day streak`}
                        >
                          <Flame size={11} /> {stats.streak}d
                        </span>
                      )}
                    </div>

                    {/* 7-day mini strip */}
                    <div
                      className="flex items-center gap-1.5 mt-2"
                      style={{ fontFamily: MONO }}
                      aria-label="Last 7 days"
                    >
                      {days.map((date) => {
                        const s = getStatus(habit.id, date);
                        const t = isToday(date);
                        const done = s === "done";
                        const skip = s === "skip";
                        return (
                          <button
                            key={date}
                            onClick={() => onToggleDay(habit.id, date)}
                            aria-label={`${habit.name} ${dayLetter(date)} ${dayNum(date)} — ${s === "none" ? "not done" : s}`}
                            className="group/day flex flex-col items-center gap-1 cursor-pointer"
                          >
                            <span
                              className={`block h-2 w-6 rounded-full transition-all ${
                                t ? "ring-1 ring-brand/60 ring-offset-1 ring-offset-surface" : ""
                              }`}
                              style={{
                                backgroundColor: done
                                  ? habit.color
                                  : skip
                                  ? "var(--warn, #E8B44A)"
                                  : "var(--surface-sunken)",
                                opacity: done ? 1 : skip ? 0.7 : 1,
                              }}
                            />
                            <span
                              className={`text-[9px] ${t ? "text-brand font-bold" : "text-ink-muted/70"}`}
                            >
                              {dayLetter(date)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overflow menu */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenMenu(isMenuOpen ? null : habit.id)}
                      aria-label={`Options for ${habit.name}`}
                      aria-expanded={isMenuOpen}
                      className="h-9 w-9 grid place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    <AnimatePresence>
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenu(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.96 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-surface border border-edge rounded-xl shadow-lg overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                setConfirmDelete({ id: habit.id, name: habit.name });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink-muted hover:text-destructive hover:bg-surface-sunken transition-colors text-left cursor-pointer"
                            >
                              <Trash2 size={14} /> Delete habit
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* Add-habit — inline, quiet */}
      <div className="mt-4">
        <AnimatePresence mode="wait">
          {showAddForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-surface border border-edge rounded-2xl p-4 space-y-3"
            >
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                placeholder="Name it. e.g. drink water, stretch, read…"
                className="w-full bg-transparent border-b border-edge focus:border-brand outline-none text-base text-ink placeholder:text-ink-muted/60 pb-2 transition-colors"
                autoFocus
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {HABIT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      aria-label={`Choose color ${c}`}
                      aria-pressed={selectedColor === c}
                      className={`h-7 w-7 rounded-full transition-all cursor-pointer ${
                        selectedColor === c
                          ? "ring-2 ring-offset-2 ring-offset-surface ring-ink/50 scale-110"
                          : "hover:scale-105 opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowAddForm(false); setNewHabitName(""); }}
                    className="h-10 px-3 rounded-full text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddHabit}
                    disabled={!newHabitName.trim()}
                    className="h-10 px-4 rounded-full bg-brand text-primary-foreground text-sm font-bold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
                  >
                    Add habit
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl border border-dashed border-edge text-ink-muted hover:text-brand hover:border-brand/50 transition-colors cursor-pointer text-sm font-semibold"
            >
              <Plus size={16} />
              New habit
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer hint — small */}
      {habits.length > 0 && habits.length < 4 && (
        <p
          className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted/70 mt-6"
          style={{ fontFamily: MONO }}
        >
          tap the big button = done today · tap a dot = mark that day
        </p>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <div
            className="fixed inset-0 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="habit-delete-title"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-surface border border-edge p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
              style={{ fontFamily: BODY }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted"
                style={{ fontFamily: MONO }}
              >
                delete habit
              </div>
              <h3 id="habit-delete-title" className="text-lg font-bold text-ink">
                Remove "{confirmDelete.name}"?
              </h3>
              <p className="text-sm text-ink-muted">
                The streak and history disappear with it. This can't be undone.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="h-10 px-4 rounded-full text-sm font-semibold text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteHabit(confirmDelete.id);
                    onGubbyMessage("Habit removed. Fresh start any time. 🌿", "cozy");
                    setConfirmDelete(null);
                  }}
                  className="h-10 px-4 rounded-full bg-destructive text-destructive-foreground text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Close menu on X icon consumers */}
      <X className="hidden" aria-hidden />
    </div>
  );
}
