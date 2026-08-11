/**
 * DailyPlannerModule — a deliberately quiet single-day view.
 *
 *  header: day + gentle progress
 *  ── the one non-negotiable
 *  ── today's short list (quick add, focus, done)
 *  ── timeline (collapsed by default) for people who want hour blocks
 *
 * Tasks are the existing global Task objects — a task belongs to this day
 * when `scheduledDate` matches, and sits in an hour slot via `scheduledTime`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Trash2,
  Plus,
  Play,
  Inbox,
} from "lucide-react";
import type { Task, CalendarEvent } from "../types";
import { toLocalDateKey } from "../lib/constants";
import { readJSON, writeJSON } from "../lib/safeStorage";

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

const START_HOUR = 6;
const END_HOUR = 22;

interface DayMeta {
  oneThing: string;
  oneThingDone: boolean;
}

const EMPTY_META: DayMeta = { oneThing: "", oneThingDone: false };

const metaKey = (d: string) => `daily-os:${d}`;

function hourKey(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base}${suffix}`;
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
  const [showTimeline, setShowTimeline] = useState(false);
  const [meta, setMeta] = useState<DayMeta>(EMPTY_META);
  const addRef = useRef<HTMLInputElement | null>(null);

  // Per-day metadata is local and lightweight — just the one non-negotiable.
  useEffect(() => {
    setMeta(readJSON<DayMeta>(metaKey(date), EMPTY_META));
  }, [date]);

  const patchMeta = (patch: Partial<DayMeta>) => {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(metaKey(date), next);
      return next;
    });
  };

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
  const dayEvents = useMemo(() => manualEvents.filter((e) => e.date === date), [manualEvents, date]);

  const done = dayTasks.filter((t) => t.completed).length;
  const pct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const nowHour = new Date().getHours();

  // A task added straight into an hour block is created first, then given its
  // time. Creation may be async, so we retry until the new task shows up.
  const [pending, setPending] = useState<{ title: string; time: string; tries: number } | null>(null);

  useEffect(() => {
    if (!pending) return;
    const match = [...tasks]
      .reverse()
      .find((t) => t.title === pending.title && t.scheduledDate === date && !t.scheduledTime);
    if (match) {
      setPending(null);
      void onUpdateTask(match.id, { scheduledTime: pending.time });
      return;
    }
    if (pending.tries > 20) {
      setPending(null);
      return;
    }
    const id = window.setTimeout(() => setPending((p) => (p ? { ...p, tries: p.tries + 1 } : p)), 100);
    return () => window.clearTimeout(id);
  }, [pending, tasks, date, onUpdateTask]);

  const commitHourAdd = (time: string) => {
    const title = draft.trim();
    setDraft("");
    setAddingHour(null);
    if (!title) return;
    void Promise.resolve(onAddTask(title, "medium", undefined, date, 25)).then(() => {
      setPending({ title, time, tries: 0 });
    });
    onGubbyMessage(`Blocked "${title}" at ${time}. One thing at a time 🌱`, "cozy");
  };

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

  const mono = "font-mono tracking-[0.16em] uppercase";

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink font-fredoka leading-tight">
              {isToday ? "Today" : prettyDate(date).split(",")[0]}
            </h1>
            <p className="text-sm text-ink-muted mt-1 truncate">{prettyDate(date)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => onSelectDate(shiftDay(date, -1))}
              className="p-2 rounded-xl border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => onSelectDate(today)}
                className="px-3 py-1.5 rounded-xl border border-edge text-xs font-bold text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
              >
                Today
              </button>
            )}
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
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-[3px] rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full bg-brand transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-[10px] text-ink-muted ${mono}`}>
            {done}/{dayTasks.length} done
          </span>
        </div>
      </header>

      {/* One thing */}
      <section className="mb-8">
        <p className={`text-[10px] text-ink-muted ${mono} mb-3`}>The one thing</p>
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
            meta.oneThingDone ? "border-brand/50 bg-brand/10" : "border-edge bg-surface-sunken"
          }`}
        >
          <button
            type="button"
            aria-label={meta.oneThingDone ? "Mark not done" : "Mark done"}
            onClick={() => patchMeta({ oneThingDone: !meta.oneThingDone })}
            className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
              meta.oneThingDone
                ? "bg-brand border-brand text-surface"
                : "border-edge text-transparent hover:border-brand"
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <input
            value={meta.oneThing}
            onChange={(e) => patchMeta({ oneThing: e.target.value })}
            placeholder="If only one thing happens today…"
            className={`flex-1 bg-transparent outline-none text-base sm:text-lg font-extrabold font-fredoka placeholder:text-ink-muted/60 placeholder:font-semibold ${
              meta.oneThingDone ? "line-through text-ink-muted" : "text-ink"
            }`}
          />
        </div>
      </section>

      {/* Short list */}
      <section className="mb-8">
        <p className={`text-[10px] text-ink-muted ${mono} mb-3`}>Short list</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dropOnHour(undefined);
          }}
          className="space-y-1.5"
        >
          {unscheduled.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                t.completed ? "border-transparent bg-transparent" : "border-edge bg-surface-sunken"
              }`}
              style={{ opacity: dragId === t.id ? 0.4 : 1 }}
            >
              <button
                type="button"
                aria-label={t.completed ? "Mark not done" : "Mark done"}
                onClick={() => onToggleTask(t.id)}
                className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                  t.completed ? "bg-brand border-brand text-surface" : "border-edge text-transparent hover:border-brand"
                }`}
              >
                <Check size={11} strokeWidth={3} />
              </button>
              <span
                className={`flex-1 min-w-0 truncate text-sm font-semibold ${
                  t.completed ? "line-through text-ink-muted" : "text-ink"
                }`}
              >
                {t.title}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label={`Focus on ${t.title}`}
                  onClick={() => onFocusTask(t.title, undefined, t.id)}
                  className="p-1.5 rounded-md text-ink-muted hover:text-brand transition-colors"
                >
                  <Play size={12} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${t.title}`}
                  onClick={() => onDeleteTask(t.id)}
                  className="p-1.5 rounded-md text-ink-muted hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {unscheduled.length === 0 && (
            <p className="text-xs text-ink-muted italic px-1">
              Nothing loose right now. Add one small thing below.
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-edge focus-within:border-brand transition-colors">
          <Plus size={14} className="text-ink-muted shrink-0" />
          <input
            value={trayDraft}
            onChange={(e) => setTrayDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTrayAdd();
              }
            }}
            placeholder="Add something small"
            className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-ink-muted/60"
          />
        </div>
      </section>

      {/* Timeline (opt-in) */}
      <section className="pb-4">
        <button
          type="button"
          onClick={() => setShowTimeline((v) => !v)}
          className={`flex items-center gap-1.5 text-[10px] text-ink-muted hover:text-ink ${mono} transition-colors`}
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showTimeline ? "" : "-rotate-90"}`}
          />
          Timeline
        </button>

        {showTimeline && (
          <div className="flex flex-col gap-1 mt-4">
            {hours.map((h) => {
              const key = hourKey(h);
              const items = scheduled.get(key) ?? [];
              const events = dayEvents.filter((e) => e.time?.startsWith(String(h).padStart(2, "0")));
              const isNow = isToday && h === nowHour;
              return (
                <div key={key} className="flex items-start gap-2.5">
                  <span
                    className={`font-mono text-[10px] w-11 text-right pt-2.5 shrink-0 tabular-nums ${
                      isNow ? "text-brand font-bold" : "text-ink-muted"
                    }`}
                  >
                    {hourLabel(h)}
                  </span>
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
                    className={`group flex-1 min-w-0 rounded-lg border border-l-[3px] px-3 py-1.5 min-h-10 space-y-1 cursor-pointer transition-colors ${
                      dragOverHour === key ? "bg-surface-sunken" : "bg-surface-sunken/50"
                    } ${isNow ? "border-l-brand border-edge" : "border-edge"}`}
                  >
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
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-edge"
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
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-ink-muted flex items-center gap-1 py-0.5">
                        <Plus size={11} /> add a block
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
