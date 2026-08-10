/**
 * DailyPlannerModule — a single-day ADHD planner built around time blocks.
 *
 *  ┌ header: date nav + "Top 3" intentions ─────────────────┐
 *  │ left: hour-by-hour timeline (drop targets)             │
 *  │ right: unscheduled tray + day stats                    │
 *  └────────────────────────────────────────────────────────┘
 *
 * Tasks are the existing global Task objects — a task belongs to this day
 * when `scheduledDate` matches, and sits in an hour slot via `scheduledTime`.
 */
import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Plus,
  Play,
  Inbox,
  Sun,
  Sunset,
  Moon,
  Coffee,
} from "lucide-react";
import type { Task, CalendarEvent } from "../types";
import { toLocalDateKey } from "../lib/constants";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

export interface DailyPlannerModuleProps {
  tasks: Task[];
  manualEvents: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  onAddTask: (
    title: string,
    priority: "low" | "medium" | "high",
    notes?: string,
    scheduledDate?: string,
    estimatedMinutes?: number,
  ) => Promise<void> | void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
}

/** 6am → 10pm, the window that covers almost every planned day. */
const START_HOUR = 6;
const END_HOUR = 22;

interface Band {
  label: string;
  Icon: typeof Sun;
  from: number;
  to: number;
  accent: string;
}

const BANDS: Band[] = [
  { label: "Morning", Icon: Coffee, from: 6, to: 11, accent: "#F59E0B" },
  { label: "Midday", Icon: Sun, from: 12, to: 16, accent: "#0EA5E9" },
  { label: "Evening", Icon: Sunset, from: 17, to: 20, accent: "#F97316" },
  { label: "Night", Icon: Moon, from: 21, to: 22, accent: "#8B5CF6" },
];

function bandFor(hour: number): Band {
  return BANDS.find((b) => hour >= b.from && hour <= b.to) ?? BANDS[0];
}

function hourKey(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function hourLabel(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base} ${suffix}`;
}

function shiftDay(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + delta);
  return toLocalDateKey(dt);
}

function prettyDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function DailyPlannerModule({
  tasks,
  manualEvents,
  selectedDate,
  onSelectDate,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onFocusTask,
  onGubbyMessage,
}: DailyPlannerModuleProps) {
  const today = toLocalDateKey(new Date());
  const date = selectedDate || today;
  const isToday = date === today;

  const [addingHour, setAddingHour] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [trayDraft, setTrayDraft] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);

  const dayTasks = useMemo(() => tasks.filter((t) => t.scheduledDate === date), [tasks, date]);

  const scheduled = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of dayTasks) {
      if (!t.scheduledTime) continue;
      const h = Number(t.scheduledTime.slice(0, 2));
      const clamped = Math.min(END_HOUR, Math.max(START_HOUR, isNaN(h) ? START_HOUR : h));
      const key = hourKey(clamped);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [dayTasks]);

  const unscheduled = useMemo(() => dayTasks.filter((t) => !t.scheduledTime), [dayTasks]);
  const dayEvents = useMemo(
    () => manualEvents.filter((e) => e.date === date),
    [manualEvents, date],
  );

  const done = dayTasks.filter((t) => t.completed).length;
  const plannedMinutes = dayTasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + (t.estimatedMinutes ?? 25), 0);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const nowHour = new Date().getHours();

  const commitHourAdd = (time: string) => {
    const title = draft.trim();
    setDraft("");
    setAddingHour(null);
    if (!title) return;
    void Promise.resolve(onAddTask(title, "medium", undefined, date, 25)).then(() => {
      // The new task lands unscheduled; move it into this slot once it exists.
      window.setTimeout(() => {
        const created = [...tasksRef.current]
          .reverse()
          .find((t) => t.title === title && t.scheduledDate === date && !t.scheduledTime);
        if (created) void onUpdateTask(created.id, { scheduledTime: time });
      }, 60);
    });
    onGubbyMessage(`Blocked "${title}" at ${time}. One thing at a time 🌱`, "cozy");
  };

  // Keep a live ref so the post-add lookup sees the newest list.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const commitTrayAdd = () => {
    const title = trayDraft.trim();
    if (!title) return;
    setTrayDraft("");
    void onAddTask(title, "medium", undefined, date, 25);
  };

  const dropOnHour = (time: string | undefined) => {
    if (!dragId) return;
    void onUpdateTask(dragId, { scheduledTime: time, scheduledDate: date });
    setDragId(null);
    setDragOverHour(null);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <header className="mb-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-muted mb-1">
          Daily Planner
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-fredoka">
            {isToday ? "Today" : prettyDate(date)}
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onSelectDate(shiftDay(date, -1))}
              className="p-2 rounded-xl border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onSelectDate(today)}
              className="px-3 py-1.5 rounded-xl border border-edge text-xs font-bold text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => onSelectDate(shiftDay(date, 1))}
              className="p-2 rounded-xl border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {isToday && (
          <p className="text-sm text-ink-muted mt-1">{prettyDate(date)}</p>
        )}
      </header>

      {/* Day stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Blocked", value: `${scheduled.size} slots` },
          { label: "Done", value: `${done}/${dayTasks.length}` },
          { label: "Planned", value: `${Math.round(plannedMinutes / 6) / 10}h` },
        ].map((s) => (
          <div key={s.label} className="bg-surface-sunken border border-edge rounded-2xl px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{s.label}</p>
            <p className="text-base font-extrabold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Timeline */}
        <section className="flex-1 min-w-0" aria-label="Hour by hour time blocks">
          <div className="flex flex-col">
            {hours.map((h) => {
              const key = hourKey(h);
              const band = bandFor(h);
              const items = scheduled.get(key) ?? [];
              const events = dayEvents.filter((e) => e.time?.startsWith(String(h).padStart(2, "0")));
              const isNow = isToday && h === nowHour;
              const bandStart = h === band.from;
              return (
                <div key={key}>
                  {bandStart && (
                    <div className="flex items-center gap-2 mt-4 mb-1.5 first:mt-0">
                      <band.Icon size={13} style={{ color: band.accent }} aria-hidden />
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
                        style={{ color: band.accent }}
                      >
                        {band.label}
                      </span>
                      <span className="flex-1 h-px bg-edge" />
                    </div>
                  )}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverHour(key);
                    }}
                    onDragLeave={() => setDragOverHour((k) => (k === key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropOnHour(key);
                    }}
                    onClick={() => {
                      setAddingHour(key);
                      setDraft("");
                      window.setTimeout(() => addRef.current?.focus(), 10);
                    }}
                    className={`group grid grid-cols-[56px_minmax(0,1fr)] gap-2 rounded-xl px-2 py-1.5 cursor-pointer transition-colors ${
                      dragOverHour === key ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
                    }`}
                    style={
                      isNow
                        ? { boxShadow: `inset 3px 0 0 0 ${band.accent}` }
                        : undefined
                    }
                  >
                    <div className="pt-1.5">
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          isNow ? "text-brand" : "text-ink-muted"
                        }`}
                      >
                        {hourLabel(h)}
                      </span>
                    </div>
                    <div className="min-h-9 border-b border-edge/60 pb-1 space-y-1">
                      {events.map((evt) => (
                        <div
                          key={evt.id}
                          className="text-[12px] font-semibold px-2 py-1 rounded-lg border border-dashed border-edge text-ink-muted"
                        >
                          📅 {evt.title}
                        </div>
                      ))}
                      {items.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-edge card-shadow"
                          style={{ opacity: dragId === t.id ? 0.4 : 1 }}
                        >
                          <button
                            type="button"
                            aria-label={t.completed ? "Mark not done" : "Mark done"}
                            onClick={() => onToggleTask(t.id)}
                            className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                              t.completed ? "border-brand text-brand" : "border-edge text-transparent hover:border-brand"
                            }`}
                          >
                            <Check size={10} strokeWidth={3} />
                          </button>
                          <span
                            className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${
                              t.completed ? "line-through text-ink-muted" : "text-ink"
                            }`}
                          >
                            {t.title}
                          </span>
                          <span className="text-[10px] font-bold text-ink-muted shrink-0">
                            {t.estimatedMinutes ?? 25}m
                          </span>
                          <button
                            type="button"
                            aria-label={`Focus on ${t.title}`}
                            onClick={() => onFocusTask(t.title, undefined, t.id)}
                            className="p-1 rounded-md text-ink-muted hover:text-brand transition-colors"
                          >
                            <Play size={11} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Unschedule ${t.title}`}
                            onClick={() => onUpdateTask(t.id, { scheduledTime: undefined })}
                            className="p-1 rounded-md text-ink-muted hover:text-ink transition-colors"
                          >
                            <Inbox size={11} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${t.title}`}
                            onClick={() => onDeleteTask(t.id)}
                            className="p-1 rounded-md text-ink-muted hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                      {addingHour === key && (
                        <input
                          ref={addRef}
                          value={draft}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitHourAdd(key);
                            } else if (e.key === "Escape") {
                              setDraft("");
                              setAddingHour(null);
                            }
                          }}
                          onBlur={() => commitHourAdd(key)}
                          placeholder={`What happens at ${hourLabel(h)}?`}
                          className="w-full text-[13px] bg-transparent outline-none text-ink placeholder:text-ink-muted/60 py-1"
                        />
                      )}
                      {items.length === 0 && events.length === 0 && addingHour !== key && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-ink-muted flex items-center gap-1 py-1">
                          <Plus size={11} /> add a block
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Unscheduled tray */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dropOnHour(undefined);
            }}
            className="bg-surface-sunken border border-edge rounded-3xl p-4 card-shadow"
          >
            <div className="flex items-center gap-2 mb-3">
              <Inbox size={15} className="text-brand" aria-hidden />
              <h2 className="text-sm font-bold text-ink font-fredoka">Not yet blocked</h2>
            </div>
            <div className="space-y-1.5 mb-3">
              {unscheduled.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-surface border border-edge cursor-grab active:cursor-grabbing"
                  style={{ opacity: dragId === t.id ? 0.4 : 1 }}
                >
                  <span
                    className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${
                      t.completed ? "line-through text-ink-muted" : "text-ink"
                    }`}
                  >
                    {t.title}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${t.title}`}
                    onClick={() => onDeleteTask(t.id)}
                    className="p-1 rounded-md text-ink-muted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {unscheduled.length === 0 && (
                <p className="text-xs text-ink-muted italic">
                  Everything has a home. Drag a block back here to unschedule it.
                </p>
              )}
            </div>
            <input
              value={trayDraft}
              onChange={(e) => setTrayDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTrayAdd();
                }
              }}
              placeholder="+ quick add for this day"
              className="w-full text-[13px] bg-surface border border-edge rounded-xl px-3 py-2 outline-none text-ink placeholder:text-ink-muted/60 focus:border-brand transition-colors"
            />
          </div>

          <div className="bg-surface-sunken border border-edge rounded-3xl p-4 card-shadow">
            <h2 className="text-sm font-bold text-ink font-fredoka mb-2">Block-planning tips</h2>
            <ul className="text-xs text-ink-muted leading-relaxed space-y-1.5 list-disc pl-4">
              <li>Leave every other hour empty — transitions take time.</li>
              <li>Put the scariest task in your best energy band.</li>
              <li>One block = one thing. If it needs two, split it.</li>
              <li>Unfinished? Drag it to a later hour, don't delete it.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
