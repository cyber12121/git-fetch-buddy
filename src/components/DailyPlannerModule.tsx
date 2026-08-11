/**
 * DailyPlannerModule — an "ADHD Daily OS" single-day console.
 *
 *  header: date + live clock + day XP bar
 *  ── energy level
 *  ── the one non-negotiable
 *  ── top 3 missions (today's tasks)
 *  ── hour blocks (6am → 10pm) with a colour palette + drag/drop tasks
 *  ── unscheduled tray
 *  ── end-of-day reflection
 *  ── day score card
 *
 * Tasks are the existing global Task objects — a task belongs to this day
 * when `scheduledDate` matches, and sits in an hour slot via `scheduledTime`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Plus,
  Play,
  Inbox,
  Eraser,
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

const ENERGY = [
  { v: 1, label: "Depleted", color: "#94A3B8" },
  { v: 2, label: "Low", color: "#A78BFA" },
  { v: 3, label: "Steady", color: "#0EA5E9" },
  { v: 4, label: "Charged", color: "#22C55E" },
  { v: 5, label: "Beast mode", color: "#F97316" },
];

const PALETTE = [
  { label: "DEEP WORK", color: "#0EA5E9" },
  { label: "ADMIN", color: "#A78BFA" },
  { label: "MOVE", color: "#22C55E" },
  { label: "REST", color: "#F59E0B" },
  { label: "PEOPLE", color: "#F43F5E" },
];

interface DayMeta {
  energy: number;
  oneThing: string;
  oneThingDone: boolean;
  win: string;
  drag: string;
  blocks: Record<string, { label: string; color: string }>;
}

const EMPTY_META: DayMeta = {
  energy: 0,
  oneThing: "",
  oneThingDone: false,
  win: "",
  drag: "",
  blocks: {},
};

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
  const [activePalette, setActivePalette] = useState<string | null>(null);
  const [meta, setMeta] = useState<DayMeta>(EMPTY_META);
  const [clock, setClock] = useState("--:--");
  const addRef = useRef<HTMLInputElement | null>(null);

  // Live clock (client only).
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
      );
    tick();
    const id = window.setInterval(tick, 1000 * 20);
    return () => window.clearInterval(id);
  }, []);

  // Per-day metadata is local and lightweight — energy, one thing, reflection.
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

  // Missions are the day's *unscheduled* tasks — anything painted into an hour
  // block lives in the timeline instead, so it never shows up in both places.
  const missions = useMemo(() => unscheduled.slice(0, 3), [unscheduled]);
  const done = dayTasks.filter((t) => t.completed).length;

  // Day score: one thing (40) + missions (40) + energy logged (20).
  const score = useMemo(() => {
    let s = 0;
    if (meta.oneThingDone) s += 40;
    const m = missions.length || 1;
    s += Math.round((missions.filter((t) => t.completed).length / m) * 40);
    if (meta.energy > 0) s += 20;
    return Math.min(100, s);
  }, [meta.oneThingDone, meta.energy, missions]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  const nowHour = new Date().getHours();


  // A task added straight into an hour block is created first, then given its
  // time. Creation may be async, so we retry until the new task shows up —
  // otherwise it stays unscheduled and pops out in the missions list instead.
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

  const paintHour = (key: string) => {
    if (!activePalette) return false;
    const entry = PALETTE.find((p) => p.label === activePalette)!;
    const current = meta.blocks[key];
    const blocks = { ...meta.blocks };
    if (current && current.label === entry.label) delete blocks[key];
    else blocks[key] = { label: entry.label, color: entry.color };
    patchMeta({ blocks });
    return true;
  };

  const mono = "font-mono tracking-[0.16em] uppercase";

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <header className="rounded-3xl border border-edge bg-surface p-5 sm:p-6 card-shadow">
        <div className="h-[3px] rounded-full bg-surface-sunken overflow-hidden mb-4">

          <div
            className="h-full bg-brand transition-[width] duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className={`text-[10px] text-ink-muted ${mono} mb-1`}>ADHD Daily OS</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink font-fredoka">
              {isToday ? "Today" : prettyDate(date)}
            </h1>
            {isToday && <p className="text-sm text-ink-muted mt-0.5">{prettyDate(date)}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-brand tabular-nums">{clock}</span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-brand text-brand ${mono}`}>
              {score}% day
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3">
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
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* Energy */}
      <section className="rounded-3xl border border-edge bg-surface p-5 card-shadow">

        <p className={`text-[10px] text-ink-muted ${mono} mb-3`}>// Energy level</p>
        <div className="flex flex-wrap gap-2">
          {ENERGY.map((e) => {
            const on = meta.energy === e.v;
            return (
              <button
                key={e.v}
                type="button"
                onClick={() => patchMeta({ energy: on ? 0 : e.v })}
                className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] px-3.5 py-2 rounded-lg border transition-colors ${
                  on ? "" : "border-edge text-ink-muted hover:text-ink"
                }`}
                style={
                  on
                    ? { borderColor: e.color, color: e.color, background: `${e.color}1F` }
                    : undefined
                }
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* One thing */}
      <section className="rounded-3xl border border-edge bg-surface p-5 card-shadow">

        <p className={`text-[10px] text-ink-muted ${mono} mb-3`}>// Non-negotiable</p>
        <div className="flex items-center gap-3">
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
            placeholder="The ONE thing that must happen today…"
            className={`flex-1 bg-transparent outline-none text-lg font-extrabold font-fredoka placeholder:text-ink-muted/60 ${
              meta.oneThingDone ? "line-through text-ink-muted" : "text-ink"
            }`}
          />
        </div>
      </section>
      </div>

      {/* Top 3 missions */}
      <section className="rounded-3xl border border-edge bg-surface p-5 card-shadow">

        <div className="flex items-center justify-between mb-3">
          <p className={`text-[10px] text-ink-muted ${mono}`}>// Top 3 missions</p>
          <span className={`text-[10px] text-ink-muted ${mono}`}>
            {missions.filter((t) => t.completed).length}/{missions.length || 3} done
          </span>
        </div>
        <div className="space-y-2">
          {missions.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                t.completed ? "border-brand/40 bg-brand/10" : "border-edge bg-surface-sunken"
              }`}
            >
              <span className="font-mono text-[11px] text-ink-muted w-4">{i + 1}</span>
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
              <button
                type="button"
                aria-label={`Focus on ${t.title}`}
                onClick={() => onFocusTask(t.title, undefined, t.id)}
                className="p-1 rounded-md text-ink-muted hover:text-brand transition-colors"
              >
                <Play size={12} />
              </button>
            </div>
          ))}
          {missions.length === 0 && (
            <p className="text-xs text-ink-muted italic">
              No missions yet — add one below and it becomes today's top 3.
            </p>
          )}
        </div>
      </section>

      {/* Time blocks */}
      <section className="py-5 border-t border-edge">
        <div className="flex items-center justify-between mb-3">
          <p className={`text-[10px] text-ink-muted ${mono}`}>// Time blocks</p>
          {Object.keys(meta.blocks).length > 0 && (
            <button
              type="button"
              onClick={() => patchMeta({ blocks: {} })}
              className={`flex items-center gap-1 text-[10px] text-ink-muted hover:text-ink ${mono}`}
            >
              <Eraser size={11} /> clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {PALETTE.map((p) => {
            const on = activePalette === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setActivePalette(on ? null : p.label)}
                className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] px-3 py-1.5 rounded-lg border transition-colors ${
                  on ? "" : "border-edge text-ink-muted hover:text-ink"
                }`}
                style={on ? { borderColor: p.color, color: p.color, background: `${p.color}1F` } : undefined}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1">
          {hours.map((h) => {
            const key = hourKey(h);
            const items = scheduled.get(key) ?? [];
            const events = dayEvents.filter((e) => e.time?.startsWith(String(h).padStart(2, "0")));
            const isNow = isToday && h === nowHour;
            const paint = meta.blocks[key];
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
                    if (paintHour(key)) return;
                    setAddingHour(key);
                    setDraft("");
                    window.setTimeout(() => addRef.current?.focus(), 10);
                  }}
                  className={`group flex-1 min-w-0 rounded-lg border border-l-[3px] px-3 py-1.5 min-h-10 space-y-1 transition-colors ${
                    dragOverHour === key ? "bg-surface-sunken" : "bg-surface-sunken/50"
                  } ${activePalette ? "cursor-crosshair" : "cursor-pointer"}`}
                  style={{
                    borderColor: paint ? `${paint.color}55` : undefined,
                    borderLeftColor: paint ? paint.color : isNow ? "var(--brand, currentColor)" : undefined,
                    background: paint ? `${paint.color}14` : undefined,
                  }}
                >
                  {paint && (
                    <span
                      className="font-mono text-[10px] tracking-[0.14em]"
                      style={{ color: paint.color }}
                    >
                      {paint.label}
                    </span>
                  )}
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
                  {items.length === 0 && events.length === 0 && !paint && addingHour !== key && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-ink-muted flex items-center gap-1 py-0.5">
                      <Plus size={11} /> add a block
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Unscheduled tray */}
      <section className="py-5 border-t border-edge">
        <p className={`text-[10px] text-ink-muted ${mono} mb-3`}>// Not yet blocked</p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            dropOnHour(undefined);
          }}
          className="bg-surface-sunken border border-edge rounded-2xl p-4"
        >
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
      </section>

      {/* Reflection */}
      <section className="py-5 border-t border-edge grid sm:grid-cols-2 gap-5">
        <div>
          <p className={`text-[10px] text-brand ${mono} mb-2`}>Win of the day</p>
          <input
            value={meta.win}
            onChange={(e) => patchMeta({ win: e.target.value })}
            placeholder="Something that went right…"
            className="w-full bg-transparent outline-none text-sm font-semibold text-ink placeholder:text-ink-muted/60 border-b border-edge pb-2 focus:border-brand transition-colors"
          />
        </div>
        <div>
          <p className={`text-[10px] text-ink-muted ${mono} mb-2`}>What dragged</p>
          <input
            value={meta.drag}
            onChange={(e) => patchMeta({ drag: e.target.value })}
            placeholder="Friction to fix tomorrow…"
            className="w-full bg-transparent outline-none text-sm font-semibold text-ink placeholder:text-ink-muted/60 border-b border-edge pb-2 focus:border-brand transition-colors"
          />
        </div>
      </section>

      {/* Day score */}
      <div
        className={`mt-6 mb-2 p-5 rounded-2xl border transition-colors ${
          score === 100 ? "border-brand bg-brand/10" : "border-edge bg-surface-sunken"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] text-ink-muted ${mono} mb-1`}>Day score</p>
            <p className="text-4xl font-extrabold font-fredoka text-ink leading-none">
              {score}
              <span className="text-base font-normal text-ink-muted">/100</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl" aria-hidden>
              {score === 100 ? "🏆" : score >= 60 ? "🔥" : score > 0 ? "🌱" : "😴"}
            </span>
            <p className={`text-[10px] text-ink-muted ${mono} mt-1`}>
              {done}/{dayTasks.length} tasks
            </p>
          </div>
        </div>
        <div className="mt-3 h-1 rounded-full bg-edge overflow-hidden">
          <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}
