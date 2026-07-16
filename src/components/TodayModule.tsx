import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Brain,
  CheckCircle2,
  ListTodo,
  Sparkles,
  Inbox,
  Repeat,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import type { Task, Habit, HabitLog } from "../types";

interface Props {
  tasks: Task[];
  habits: Habit[];
  habitLog: HabitLog;
  onOpenTab: (tab: "compiler" | "todo" | "taskmaster" | "habits") => void;
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * "Today" dashboard — a calm, one-glance summary. Layout follows the
 * reference (greeting → next action → stat row → progress → tip) but uses
 * the app's own semantic tokens so any active theme just works.
 */
export default function TodayModule({ tasks, habits, habitLog, onOpenTab }: Props) {
  const today = new Date();
  const iso = todayISO();
  const dateLabel = `${WEEKDAY[today.getDay()]}, ${MONTH[today.getMonth()]} ${today.getDate()}`;

  const {
    doneToday,
    openTasks,
    habitsDone,
    toSort,
    progressPct,
  } = useMemo(() => {
    const scheduledToday = tasks.filter((t) => t.scheduledDate === iso);
    const doneToday = scheduledToday.filter((t) => t.completed).length;
    const openTasks = tasks.filter((t) => !t.completed).length;
    const habitsDone = habits.filter((h) => habitLog[`${h.id}:${iso}`] === "done").length;
    const toSort = tasks.filter((t) => !t.scheduledDate && !t.completed).length;

    const totalToday = scheduledToday.length;
    const progressPct = totalToday === 0 ? 0 : Math.round((doneToday / totalToday) * 100);

    return { doneToday, openTasks, habitsDone, toSort, progressPct };
  }, [tasks, habits, habitLog, iso]);


  const stats: Array<{ label: string; value: string; Icon: typeof CheckCircle2 }> = [
    { label: "Done today", value: String(doneToday), Icon: CheckCircle2 },
    { label: "Open tasks", value: String(openTasks), Icon: ListTodo },
    { label: "Habits today", value: `${habitsDone}/${habits.length}`, Icon: Repeat },
    { label: "To sort", value: String(toSort), Icon: Inbox },
  ];

  return (
    <section aria-labelledby="today-heading" className="w-full">
      <p className="text-xs font-semibold text-ink-muted mb-1.5">{dateLabel}</p>
      <h1
        id="today-heading"
        className="font-fredoka text-3xl sm:text-4xl font-black text-ink tracking-tight leading-[1.05] mb-6"
      >
        Hey. Let's do one thing.
      </h1>

      {/* Brain Dump */}
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative overflow-hidden rounded-3xl border border-edge bg-surface p-5 sm:p-6 mb-6 card-shadow"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(500px 180px at 100% 0%, var(--color-brand-soft), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-3">
            <Brain size={12} className="text-brand" aria-hidden="true" />
            <span className="text-[10px] font-extrabold text-brand uppercase tracking-[0.18em]">
              Brain dump
            </span>
          </div>
          <h2 className="font-fredoka text-xl sm:text-2xl font-extrabold text-ink leading-snug mb-4">
            Empty your head onto the page.
          </h2>
          <button
            type="button"
            onClick={() => onOpenTab("compiler")}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-bold px-4 py-2 shadow hover:brightness-110 active:scale-[0.98] transition min-h-10"
          >
            Start brain dump
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </motion.article>


      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.03 * i }}
            className="rounded-2xl border border-edge bg-surface p-4 card-shadow"
          >
            <div className="flex items-center gap-1.5 text-ink-muted mb-2">
              <s.Icon size={12} aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                {s.label}
              </span>
            </div>
            <p className="font-fredoka text-2xl sm:text-3xl font-black text-ink tabular-nums leading-none">
              {s.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Progress card */}
      <article className="rounded-2xl border border-edge bg-surface p-5 mb-4 card-shadow">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-extrabold text-ink font-fredoka">Today's progress</h3>
          <span className="text-xs font-bold text-ink-muted tabular-nums">{progressPct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 rounded-full bg-surface-sunken overflow-hidden mb-3"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            className="h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--color-brand), var(--accent))",
            }}
          />
        </div>
        <p className="text-xs text-ink-muted">
          Small wins compound. Even one is enough.
        </p>
      </article>

      {/* Principle card */}
      <article className="rounded-2xl border border-edge bg-surface-sunken p-5 card-shadow">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={14} className="text-brand" aria-hidden="true" />
          <h3 className="text-sm font-extrabold text-ink font-fredoka">The ADHD principle</h3>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Your working memory has limits. This app externalizes them —{" "}
          <button
            type="button"
            onClick={() => onOpenTab("compiler")}
            className="text-ink font-bold underline decoration-brand/60 underline-offset-2 hover:decoration-brand"
          >
            capture, then decide
          </button>
          .
          <BookOpen size={11} className="inline-block ml-1 -mt-0.5 text-ink-muted" aria-hidden="true" />
        </p>
      </article>
    </section>
  );
}
