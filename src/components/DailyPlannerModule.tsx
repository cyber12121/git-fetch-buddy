import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Plus,
  Play,
  Clock,
  Sparkles,
  GripVertical,
  Maximize2,
  Minimize2,
} from "lucide-react";

import FocusBloom from "./FocusBloom";
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
    scheduledTime?: string
  ) => Promise<void> | void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
}

const START_HOUR = 6;
const END_HOUR = 23;

const DURATIONS = [5, 10, 15, 25, 30, 45, 60, 90, 120];

const ENERGY = [
  { v: 1, label: "Depleted", color: "#94A3B8" },
  { v: 2, label: "Low", color: "#A78BFA" },
  { v: 3, label: "Steady", color: "#0EA5E9" },
  { v: 4, label: "Charged", color: "#22C55E" },
  { v: 5, label: "Beast mode", color: "#F97316" },
];

interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

interface DayMeta {
  energy: number;
  oneThing: string;
  oneThingDone: boolean;
  win: string;
  drag: string;
  goodDeed?: string;
  blocks: Record<string, { label: string; color: string }>;
  bedtime?: CheckItem[];
  thoughts?: CheckItem[];
}

const DEFAULT_BEDTIME: CheckItem[] = [
  { id: "b1", text: "Set phone to do-not-disturb", done: false },
  { id: "b2", text: "Fill water bottle for morning", done: false },
  { id: "b3", text: "Brush & floss teeth", done: false },
];

const DEFAULT_THOUGHTS: CheckItem[] = [
  { id: "t1", text: "Feeling proud of finishing my main goal", done: false },
  { id: "t2", text: "Need to buy new gym shoes this weekend", done: false },
  { id: "t3", text: "Idea for holiday recipe", done: false },
];

const EMPTY_META: DayMeta = {
  energy: 0,
  oneThing: "",
  oneThingDone: false,
  win: "",
  drag: "",
  goodDeed: "",
  blocks: {},
  bedtime: DEFAULT_BEDTIME,
  thoughts: DEFAULT_THOUGHTS,
};

const metaKey = (d: string) => `daily-os:${d}`;

function hourKey(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
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
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const [meta, setMeta] = useState<DayMeta>(EMPTY_META);
  const [clock, setClock] = useState("--:--");

  // Inline drafting for schedule hours
  const [addingHour, setAddingHour] = useState<string | null>(null);
  const [hourDraft, setHourDraft] = useState("");

  // Inline drafting for to-do tiers
  const [greatDraft, setGreatDraft] = useState("");
  const [specialDraft, setSpecialDraft] = useState("");
  const [commonDraft, setCommonDraft] = useState("");

  // Inline drafting for bottom cards
  const [newBedtimeDraft, setNewBedtimeDraft] = useState("");
  const [newThoughtDraft, setNewThoughtDraft] = useState("");

  // Inline editing state for task title
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Fullscreen view mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // Live clock
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    tick();
    const id = window.setInterval(tick, 1000 * 20);
    return () => window.clearInterval(id);
  }, []);

  // Per-day metadata
  useEffect(() => {
    const loaded = readJSON<DayMeta>(metaKey(date), EMPTY_META);
    setMeta({
      ...EMPTY_META,
      ...loaded,
      bedtime: Array.isArray(loaded.bedtime) ? loaded.bedtime : DEFAULT_BEDTIME,
      thoughts: Array.isArray(loaded.thoughts) ? loaded.thoughts : DEFAULT_THOUGHTS,
    });
  }, [date]);

  const patchMeta = (patch: Partial<DayMeta>) => {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      writeJSON(metaKey(date), next);
      return next;
    });
  };

  // Filter tasks for this day (or unscheduled tasks if viewing today)
  const dayTasks = useMemo(() => {
    return tasks.filter((t) => (t.scheduledDate ? t.scheduledDate === date : isToday));
  }, [tasks, date, isToday]);

  // Priority splits for the 2-3-5 ADHD rule
  const greatTasks = useMemo(() => dayTasks.filter((t) => t.priority === "high"), [dayTasks]);
  const specialTasks = useMemo(() => dayTasks.filter((t) => t.priority === "medium"), [dayTasks]);
  const commonTasks = useMemo(
    () =>
      dayTasks.filter(
        (t) => t.priority === "low" || (!t.priority && t.priority !== "high" && t.priority !== "medium")
      ),
    [dayTasks]
  );

  // Scheduled tasks mapping by hour
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

  const dayEvents = useMemo(() => manualEvents.filter((e) => e.date === date), [manualEvents, date]);

  const doneCount = dayTasks.filter((t) => t.completed).length;

  // Day score calculation
  const score = useMemo(() => {
    if (dayTasks.length === 0) return meta.energy > 0 ? 20 : 0;
    const taskScore = Math.round((doneCount / dayTasks.length) * 80);
    const energyBonus = meta.energy > 0 ? 20 : 0;
    return Math.min(100, taskScore + energyBonus);
  }, [doneCount, dayTasks.length, meta.energy]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  // Day of week index (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeekIndex = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  }, [date]);

  const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

  // Add task directly to a specific hour
  const commitHourAdd = (h: number) => {
    const title = hourDraft.trim();
    if (!title) {
      setAddingHour(null);
      return;
    }
    const time = hourKey(h);
    setHourDraft("");
    setAddingHour(null);
    void onAddTask(title, "medium", undefined, date, 25, time);
    onGubbyMessage(`Scheduled "${title}" at ${hourLabel(h)} ⏰`, "cozy");
  };

  // Add tasks into tiers
  const handleAddGreat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!greatDraft.trim()) return;
    const title = greatDraft.trim();
    setGreatDraft("");
    void onAddTask(title, "high", undefined, date, 25);
    onGubbyMessage(`High priority quest locked in: "${title}"! 🌟`, "focused");
  };

  const handleAddSpecial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialDraft.trim()) return;
    const title = specialDraft.trim();
    setSpecialDraft("");
    void onAddTask(title, "medium", undefined, date, 25);
    onGubbyMessage(`Special focus quest added: "${title}"! 🎯`, "focused");
  };

  const handleAddCommon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commonDraft.trim()) return;
    const title = commonDraft.trim();
    setCommonDraft("");
    void onAddTask(title, "low", undefined, date, 15);
    onGubbyMessage(`Routine quest added: "${title}". Steady rhythm! 🌱`, "cozy");
  };

  // Bedtime checklist handlers
  const toggleBedtime = (id: string) => {
    const updated = (meta.bedtime || DEFAULT_BEDTIME).map((b) =>
      b.id === id ? { ...b, done: !b.done } : b
    );
    patchMeta({ bedtime: updated });
  };

  const deleteBedtimeItem = (id: string) => {
    const current = meta.bedtime || DEFAULT_BEDTIME;
    const updated = current.filter((b) => b.id !== id);
    patchMeta({ bedtime: updated });
  };

  const addBedtimeItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBedtimeDraft.trim()) return;
    const updated = [
      ...(meta.bedtime || DEFAULT_BEDTIME),
      { id: `b_${Date.now()}`, text: newBedtimeDraft.trim(), done: false },
    ];
    setNewBedtimeDraft("");
    patchMeta({ bedtime: updated });
  };

  // Thoughts / Brain Dump handlers
  const toggleThought = (id: string) => {
    const updated = (meta.thoughts || DEFAULT_THOUGHTS).map((t) =>
      t.id === id ? { ...t, done: !t.done } : t
    );
    patchMeta({ thoughts: updated });
  };

  const deleteThoughtItem = (id: string) => {
    const current = meta.thoughts || DEFAULT_THOUGHTS;
    const updated = current.filter((t) => t.id !== id);
    patchMeta({ thoughts: updated });
  };

  const addThoughtItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThoughtDraft.trim()) return;
    const updated = [
      ...(meta.thoughts || DEFAULT_THOUGHTS),
      { id: `t_${Date.now()}`, text: newThoughtDraft.trim(), done: false },
    ];
    setNewThoughtDraft("");
    patchMeta({ thoughts: updated });
  };

  const dropOnHour = (time: string | undefined) => {
    if (!dragId) return;
    void onUpdateTask(dragId, { scheduledTime: time, scheduledDate: date });
    setDragId(null);
    setDragOverHour(null);
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] overflow-y-auto bg-[#e8f1e8] p-3 sm:p-6 md:p-8 flex justify-center items-start"
          : "w-full max-w-6xl xl:max-w-7xl mx-auto pb-16 font-sans transition-all"
      }
    >
      {/* Outer iPad bezel container for tactile digital aesthetic */}
      <div
        className={`relative bg-white rounded-[2rem] p-4 sm:p-7 md:p-8 shadow-xl border border-slate-200/80 overflow-hidden w-full ${
          isFullscreen ? "max-w-6xl xl:max-w-7xl my-auto" : ""
        }`}
      >
        {/* Decorative Golden Sparkles */}
        <div className="absolute top-5 left-5 pointer-events-none select-none text-amber-400 opacity-80 animate-pulse">
          <Sparkles size={22} />
        </div>
        <div className="absolute top-5 right-5 pointer-events-none select-none text-amber-400 opacity-80 animate-pulse">
          <Sparkles size={22} />
        </div>

        {/* ============================================================ */}
        {/* HEADER SECTION: TITLE & DATE SELECTOR BAR                    */}
        {/* ============================================================ */}
        <header className="text-center mb-5">
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div className="w-28 hidden sm:flex items-center">
              {isFullscreen && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Minimize2 size={13} />
                  <span>Exit</span>
                </button>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-wider uppercase text-slate-900 font-fredoka flex-1 text-center">
              Daily Planner
            </h1>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-700 tabular-nums bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                {clock}
              </span>
              <span className="text-xs font-extrabold text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                {score}% done
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="h-8 w-8 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 flex items-center justify-center transition-colors cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen Mode"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Date & Day of Week Bar (Lavender Card) */}
          <div className="bg-[#f0dcfa] border border-[#e2c1f3] rounded-xl px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            {/* Date navigation */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-extrabold text-slate-800 text-sm">Date:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous day"
                  onClick={() => onSelectDate(shiftDay(date, -1))}
                  className="p-1 rounded-lg text-slate-700 hover:bg-purple-200 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-slate-800 text-sm sm:text-base border-b-2 border-purple-400 px-2 py-0.5">
                  {prettyDate(date)}
                </span>
                <button
                  type="button"
                  aria-label="Next day"
                  onClick={() => onSelectDate(shiftDay(date, 1))}
                  className="p-1 rounded-lg text-slate-700 hover:bg-purple-200 transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
                {!isToday && (
                  <button
                    type="button"
                    onClick={() => onSelectDate(today)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 underline ml-1 cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {/* Day of Week Selector Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {DAYS.map((d, idx) => {
                const isSelected = idx === dayOfWeekIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const diff = idx - dayOfWeekIndex;
                      onSelectDate(shiftDay(date, diff));
                    }}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800 text-white shadow-sm scale-105"
                        : "text-slate-800 hover:bg-purple-200"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Energy level selector strip */}
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
              Energy:
            </span>
            {ENERGY.map((e) => {
              const on = meta.energy === e.v;
              return (
                <button
                  key={e.v}
                  type="button"
                  onClick={() => patchMeta({ energy: on ? 0 : e.v })}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    on ? "text-white shadow-sm scale-105" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                  }`}
                  style={on ? { backgroundColor: e.color, borderColor: e.color } : undefined}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* ============================================================ */}
        {/* MAIN 2-COLUMN GRID: SCHEDULE & PRIORITIZED TO-DO LIST        */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* COLUMN 1: SCHEDULE OF ACTIVITIES */}
          <section className="flex flex-col">
            <h2 className="text-xs sm:text-sm font-black text-center tracking-wider uppercase text-slate-800 mb-2 font-mono">
              Schedule of Activities
            </h2>

            {/* Schedule Lavender Container */}
            <div className="bg-[#fceeff] border border-[#f3c8fc] rounded-2xl p-3 sm:p-4 flex-1 flex flex-col shadow-sm">
              <div className="space-y-2">
                {hours.map((h) => {
                  const key = hourKey(h);
                  const items = scheduled.get(key) ?? [];
                  const events = dayEvents.filter((e) => e.time?.startsWith(String(h).padStart(2, "0")));
                  const isNow = isToday && new Date().getHours() === h;
                  const isHover = dragOverHour === key;

                  return (
                    <div
                      key={h}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverHour(key);
                      }}
                      onDragLeave={() => setDragOverHour((curr) => (curr === key ? null : curr))}
                      onDrop={(e) => {
                        e.preventDefault();
                        dropOnHour(key);
                      }}
                      className={`flex items-start gap-2.5 py-1 px-1.5 rounded-lg border-b border-purple-200/70 transition-colors ${
                        isHover ? "bg-purple-200/60" : isNow ? "bg-purple-100/60" : ""
                      }`}
                    >
                      <div className="w-16 flex items-center justify-between shrink-0 pt-0.5 select-none">
                        <span className="text-xs font-extrabold text-slate-800">
                          {hourLabel(h)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingHour(key);
                            setHourDraft("");
                          }}
                          className="opacity-40 hover:opacity-100 text-purple-700 p-0.5 rounded hover:bg-purple-200 transition-opacity cursor-pointer"
                          title={`Add activity at ${hourLabel(h)}`}
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Events from calendar */}
                        {events.map((ev) => (
                          <div
                            key={ev.id}
                            className="text-xs font-bold text-slate-800 bg-white/80 border border-purple-200 px-2 py-1 rounded-md shadow-xs flex items-center gap-1.5"
                          >
                            <Clock size={12} className="text-purple-600 shrink-0" />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}

                        {/* Scheduled Tasks */}
                        {items.map((t) => (
                          <div
                            key={t.id}
                            className={`group text-xs font-semibold text-slate-800 bg-white border border-purple-300 px-2 py-1.5 rounded-lg shadow-xs flex items-center justify-between gap-1.5 transition-all ${
                              t.completed ? "opacity-60 line-through" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <div
                                draggable
                                onDragStart={() => setDragId(t.id)}
                                className="cursor-grab active:cursor-grabbing text-purple-300 hover:text-purple-600 shrink-0"
                                title="Drag to reschedule"
                              >
                                <GripVertical size={13} />
                              </div>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleTask(t.id);
                                }}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                  t.completed ? "bg-slate-800 border-slate-800 text-white" : "border-slate-400 hover:border-slate-700"
                                }`}
                              >
                                {t.completed && <Check size={10} strokeWidth={3} />}
                              </button>

                              {editingTaskId === t.id ? (
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                                      setEditingTaskId(null);
                                    }
                                    if (e.key === "Escape") setEditingTaskId(null);
                                  }}
                                  onBlur={() => {
                                    if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                                    setEditingTaskId(null);
                                  }}
                                  className="bg-transparent border-b border-purple-500 outline-none text-xs font-semibold text-slate-900 px-1 w-full"
                                />
                              ) : (
                                <span
                                  onDoubleClick={() => {
                                    setEditingTaskId(t.id);
                                    setEditingTitle(t.title);
                                  }}
                                  title="Double-click to rename"
                                  className="truncate cursor-text flex-1"
                                >
                                  {t.title}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFocusTask(t.title, undefined, t.id);
                                }}
                                className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer rounded hover:bg-slate-100"
                                title="Focus on this"
                              >
                                <Play size={11} className="fill-current" />
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onUpdateTask(t.id, { scheduledTime: undefined });
                                }}
                                className="p-1 text-slate-400 hover:text-amber-700 cursor-pointer text-xs rounded hover:bg-slate-100"
                                title="Remove time only"
                              >
                                ✕
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTask(t.id);
                                  onGubbyMessage("Activity deleted 🗑️", "thoughtful");
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded hover:bg-slate-100"
                                title="Delete task permanently"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Inline add task for this hour */}
                        {addingHour === key ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              autoFocus
                              type="text"
                              value={hourDraft}
                              onChange={(e) => setHourDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitHourAdd(h);
                                if (e.key === "Escape") setAddingHour(null);
                              }}
                              placeholder="Activity / plan…"
                              className="flex-1 bg-white border border-purple-400 rounded px-2 py-0.5 outline-none text-xs text-slate-800 shadow-xs focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => commitHourAdd(h)}
                              className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingHour(null)}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-1 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          items.length === 0 &&
                          events.length === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingHour(key);
                                setHourDraft("");
                              }}
                              className="w-full text-left border-b border-dashed border-purple-300/80 hover:border-purple-500 h-6 transition-colors text-[11px] text-purple-400/60 hover:text-purple-700 px-1 flex items-center cursor-pointer"
                            >
                              + Add activity
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* COLUMN 2: TO-DO LIST (TIERED PRIORITIES - 2 / 3 / 5 RULE) */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xs sm:text-sm font-black text-center tracking-wider uppercase text-slate-800 font-mono">
              To-Do List
            </h2>

            {/* TIER 1: 2 GREAT THINGS (Yellow Card) */}
            <div className="bg-[#fef7cd] border border-[#f5eb9b] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-fredoka flex items-center gap-1.5">
                  <span>⭐ 2 Great Things</span>
                </h3>
                <span className="text-[10px] font-bold text-amber-900 font-mono bg-amber-200/80 px-2 py-0.5 rounded-full">
                  {greatTasks.length} / 2 High Priority
                </span>
              </div>

              <div className="space-y-2">
                {greatTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2.5 group py-1 border-b border-amber-200/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        className="cursor-grab active:cursor-grabbing text-amber-500/60 hover:text-amber-800 shrink-0"
                        title="Drag to Schedule to assign an hour"
                      >
                        <GripVertical size={14} />
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t.id);
                        }}
                        className={`w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center shrink-0 cursor-pointer ${
                          t.completed ? "bg-slate-800 text-white" : "bg-transparent hover:bg-amber-100"
                        }`}
                      >
                        {t.completed && <Check size={12} strokeWidth={3} />}
                      </button>

                      {editingTaskId === t.id ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                              setEditingTaskId(null);
                            }
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          onBlur={() => {
                            if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                            setEditingTaskId(null);
                          }}
                          className="bg-transparent border-b-2 border-amber-600 outline-none text-sm font-bold text-slate-900 px-1 w-full"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => {
                            setEditingTaskId(t.id);
                            setEditingTitle(t.title);
                          }}
                          title="Double-click to rename"
                          className={`text-sm font-bold text-slate-800 truncate cursor-text flex-1 ${
                            t.completed ? "line-through opacity-60" : ""
                          }`}
                        >
                          {t.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {t.scheduledTime && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          {t.scheduledTime}
                        </span>
                      )}
                      <label
                        className="relative shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded cursor-pointer tabular-nums">
                          {t.estimatedMinutes ?? 25}m
                        </span>
                        <select
                          aria-label={`Set duration for ${t.title}`}
                          value={t.estimatedMinutes ?? 25}
                          onChange={(e) => onUpdateTask(t.id, { estimatedMinutes: Number(e.target.value) })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          {DURATIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}m
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusTask(t.title, undefined, t.id);
                        }}
                        className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer rounded hover:bg-amber-100"
                        title="Focus on this mission"
                      >
                        <Play size={13} className="fill-current" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(t.id);
                          onGubbyMessage("Task deleted from today 🗑️", "thoughtful");
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded hover:bg-amber-100"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                <form onSubmit={handleAddGreat} className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-300/60">
                  <input
                    type="text"
                    value={greatDraft}
                    onChange={(e) => setGreatDraft(e.target.value)}
                    placeholder="+ Add a high-priority non-negotiable…"
                    className="flex-1 bg-transparent border-0 border-b border-amber-400 focus:border-amber-600 outline-none text-xs font-semibold text-slate-800 placeholder:text-amber-800/60 py-1"
                  />
                  {greatDraft.trim() && (
                    <button
                      type="submit"
                      className="text-xs font-bold text-amber-900 bg-amber-300 hover:bg-amber-400 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  )}
                </form>
              </div>
            </div>

            {/* TIER 2: 3 SPECIAL THINGS (Mint / Sage Card) */}
            <div className="bg-[#e4ece9] border border-[#cbd9d4] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-fredoka flex items-center gap-1.5">
                  <span>🎯 3 Special Things</span>
                </h3>
                <span className="text-[10px] font-bold text-teal-900 font-mono bg-teal-200/80 px-2 py-0.5 rounded-full">
                  {specialTasks.length} / 3 Medium Priority
                </span>
              </div>

              <div className="space-y-2">
                {specialTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2.5 group py-1 border-b border-teal-200/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        className="cursor-grab active:cursor-grabbing text-teal-600/60 hover:text-teal-800 shrink-0"
                        title="Drag to Schedule to assign an hour"
                      >
                        <GripVertical size={14} />
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t.id);
                        }}
                        className={`w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center shrink-0 cursor-pointer ${
                          t.completed ? "bg-slate-800 text-white" : "bg-transparent hover:bg-teal-100"
                        }`}
                      >
                        {t.completed && <Check size={12} strokeWidth={3} />}
                      </button>

                      {editingTaskId === t.id ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                              setEditingTaskId(null);
                            }
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          onBlur={() => {
                            if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                            setEditingTaskId(null);
                          }}
                          className="bg-transparent border-b-2 border-teal-600 outline-none text-sm font-semibold text-slate-900 px-1 w-full"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => {
                            setEditingTaskId(t.id);
                            setEditingTitle(t.title);
                          }}
                          title="Double-click to rename"
                          className={`text-sm font-semibold text-slate-800 truncate cursor-text flex-1 ${
                            t.completed ? "line-through opacity-60" : ""
                          }`}
                        >
                          {t.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {t.scheduledTime && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          {t.scheduledTime}
                        </span>
                      )}
                      <label
                        className="relative shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-bold text-teal-900 bg-teal-200 hover:bg-teal-300 px-2 py-0.5 rounded cursor-pointer tabular-nums">
                          {t.estimatedMinutes ?? 25}m
                        </span>
                        <select
                          aria-label={`Set duration for ${t.title}`}
                          value={t.estimatedMinutes ?? 25}
                          onChange={(e) => onUpdateTask(t.id, { estimatedMinutes: Number(e.target.value) })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          {DURATIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}m
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusTask(t.title, undefined, t.id);
                        }}
                        className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer rounded hover:bg-teal-100"
                        title="Focus on this mission"
                      >
                        <Play size={13} className="fill-current" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(t.id);
                          onGubbyMessage("Task deleted from today 🗑️", "thoughtful");
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded hover:bg-teal-100"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                <form onSubmit={handleAddSpecial} className="flex items-center gap-2 mt-2 pt-2 border-t border-teal-300/60">
                  <input
                    type="text"
                    value={specialDraft}
                    onChange={(e) => setSpecialDraft(e.target.value)}
                    placeholder="+ Add a special focus task…"
                    className="flex-1 bg-transparent border-0 border-b border-teal-400 focus:border-teal-600 outline-none text-xs font-semibold text-slate-800 placeholder:text-teal-800/60 py-1"
                  />
                  {specialDraft.trim() && (
                    <button
                      type="submit"
                      className="text-xs font-bold text-teal-950 bg-teal-300 hover:bg-teal-400 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  )}
                </form>
              </div>
            </div>

            {/* TIER 3: 5 COMMON THINGS (Blush Pink Card) */}
            <div className="bg-[#fce5eb] border border-[#fad2dc] rounded-2xl p-4 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-fredoka flex items-center gap-1.5">
                  <span>🌱 5 Common Things</span>
                </h3>
                <span className="text-[10px] font-bold text-pink-900 font-mono bg-pink-200/80 px-2 py-0.5 rounded-full">
                  {commonTasks.length} / 5 Routines
                </span>
              </div>

              <div className="space-y-2">
                {commonTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2.5 group py-1 border-b border-pink-200/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        className="cursor-grab active:cursor-grabbing text-pink-500/60 hover:text-pink-800 shrink-0"
                        title="Drag to Schedule to assign an hour"
                      >
                        <GripVertical size={14} />
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTask(t.id);
                        }}
                        className={`w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center shrink-0 cursor-pointer ${
                          t.completed ? "bg-slate-800 text-white" : "bg-transparent hover:bg-pink-100"
                        }`}
                      >
                        {t.completed && <Check size={12} strokeWidth={3} />}
                      </button>

                      {editingTaskId === t.id ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                              setEditingTaskId(null);
                            }
                            if (e.key === "Escape") setEditingTaskId(null);
                          }}
                          onBlur={() => {
                            if (editingTitle.trim()) void onUpdateTask(t.id, { title: editingTitle.trim() });
                            setEditingTaskId(null);
                          }}
                          className="bg-transparent border-b-2 border-pink-600 outline-none text-sm text-slate-900 px-1 w-full"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => {
                            setEditingTaskId(t.id);
                            setEditingTitle(t.title);
                          }}
                          title="Double-click to rename"
                          className={`text-sm text-slate-800 truncate cursor-text flex-1 ${
                            t.completed ? "line-through opacity-60" : ""
                          }`}
                        >
                          {t.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {t.scheduledTime && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          {t.scheduledTime}
                        </span>
                      )}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusTask(t.title, undefined, t.id);
                        }}
                        className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer rounded hover:bg-pink-100"
                        title="Focus on this mission"
                      >
                        <Play size={13} className="fill-current" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(t.id);
                          onGubbyMessage("Task deleted from today 🗑️", "thoughtful");
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer rounded hover:bg-pink-100"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                <form onSubmit={handleAddCommon} className="flex items-center gap-2 mt-2 pt-2 border-t border-pink-300/60">
                  <input
                    type="text"
                    value={commonDraft}
                    onChange={(e) => setCommonDraft(e.target.value)}
                    placeholder="+ Add a daily maintenance / routine task…"
                    className="flex-1 bg-transparent border-0 border-b border-pink-400 focus:border-pink-600 outline-none text-xs font-semibold text-slate-800 placeholder:text-pink-800/60 py-1"
                  />
                  {commonDraft.trim() && (
                    <button
                      type="submit"
                      className="text-xs font-bold text-pink-950 bg-pink-300 hover:bg-pink-400 px-2.5 py-1 rounded cursor-pointer transition-colors"
                    >
                      Add
                    </button>
                  )}
                </form>
              </div>
            </div>
          </section>
        </div>

        {/* ============================================================ */}
        {/* BOTTOM SPLIT CARDS: BEDTIME ROUTINE & WHAT I AM THINKING     */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {/* Bottom Left: Things to do before bedtime (Warm Salmon/Coral) */}
          <div className="bg-[#ffd7cf] border border-[#fcc0b3] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-fredoka flex items-center gap-1.5">
                <span>🌙 Things to do before bedtime</span>
              </h3>
              <span className="text-[10px] font-bold text-rose-900 font-mono bg-rose-200/80 px-2 py-0.5 rounded-full">
                {(meta.bedtime || DEFAULT_BEDTIME).filter((b) => b.done).length} / {(meta.bedtime || DEFAULT_BEDTIME).length}
              </span>
            </div>

            <div className="space-y-2">
              {(meta.bedtime || DEFAULT_BEDTIME).map((item) => (
                <div key={item.id} className="group flex items-center justify-between gap-2.5 py-0.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleBedtime(item.id)}
                      className={`w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center shrink-0 cursor-pointer ${
                        item.done ? "bg-slate-800 text-white" : "bg-transparent hover:bg-rose-100"
                      }`}
                    >
                      {item.done && <Check size={12} strokeWidth={3} />}
                    </button>
                    <span
                      className={`text-xs sm:text-sm font-medium text-slate-800 flex-1 truncate ${
                        item.done ? "line-through opacity-60" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBedtimeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-700 cursor-pointer rounded transition-opacity"
                    title="Delete item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <form onSubmit={addBedtimeItem} className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-300/60">
                <input
                  type="text"
                  value={newBedtimeDraft}
                  onChange={(e) => setNewBedtimeDraft(e.target.value)}
                  placeholder="+ Add bedtime routine item…"
                  className="flex-1 bg-transparent border-0 border-b border-rose-400 focus:border-rose-600 outline-none text-xs text-slate-800 placeholder:text-rose-800/60 py-1"
                />
                {newBedtimeDraft.trim() && (
                  <button
                    type="submit"
                    className="text-xs font-bold text-rose-950 bg-rose-200 hover:bg-rose-300 px-2.5 py-1 rounded cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Bottom Right: What I am thinking? (Fresh Light Green Brain Dump) */}
          <div className="bg-[#dcfbda] border border-[#c1f5bf] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-fredoka flex items-center gap-1.5">
                <span>💭 What I am thinking? (Brain Dump)</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-900 font-mono bg-emerald-200/80 px-2 py-0.5 rounded-full">
                {(meta.thoughts || DEFAULT_THOUGHTS).filter((t) => t.done).length} / {(meta.thoughts || DEFAULT_THOUGHTS).length}
              </span>
            </div>

            <div className="space-y-2">
              {(meta.thoughts || DEFAULT_THOUGHTS).map((item) => (
                <div key={item.id} className="group flex items-center justify-between gap-2.5 py-0.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleThought(item.id)}
                      className={`w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center shrink-0 cursor-pointer ${
                        item.done ? "bg-slate-800 text-white" : "bg-transparent hover:bg-emerald-100"
                      }`}
                    >
                      {item.done && <Check size={12} strokeWidth={3} />}
                    </button>
                    <span
                      className={`text-xs sm:text-sm font-medium text-slate-800 flex-1 truncate ${
                        item.done ? "line-through opacity-60" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteThoughtItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-800 cursor-pointer rounded transition-opacity"
                    title="Delete thought"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              <form onSubmit={addThoughtItem} className="flex items-center gap-2 mt-2 pt-2 border-t border-green-300/60">
                <input
                  type="text"
                  value={newThoughtDraft}
                  onChange={(e) => setNewThoughtDraft(e.target.value)}
                  placeholder="+ Add wandering thought / brain dump…"
                  className="flex-1 bg-transparent border-0 border-b border-emerald-400 focus:border-emerald-600 outline-none text-xs text-slate-800 placeholder:text-emerald-800/60 py-1"
                />
                {newThoughtDraft.trim() && (
                  <button
                    type="submit"
                    className="text-xs font-bold text-emerald-950 bg-emerald-200 hover:bg-emerald-300 px-2.5 py-1 rounded cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FOOTER CARD: DAILY REFLECTION / GOOD DEED                    */}
        {/* ============================================================ */}
        <footer className="mt-5 relative">
          <div className="bg-[#cbf7fb] border border-[#aaeef4] rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <label htmlFor="good-deed" className="text-xs sm:text-sm font-extrabold text-slate-900 shrink-0 font-fredoka">
                ✨ My good deed / win of the day is...
              </label>
              <input
                id="good-deed"
                type="text"
                value={meta.goodDeed || meta.win || ""}
                onChange={(e) => patchMeta({ goodDeed: e.target.value, win: e.target.value })}
                placeholder="Sent an encouraging text or stayed kind to myself today…"
                className="flex-1 bg-transparent border-0 border-b-2 border-teal-400 focus:border-teal-700 outline-none text-sm font-bold text-teal-950 placeholder:text-teal-700/50 py-1"
              />
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2 pointer-events-none select-none text-amber-400 opacity-80 animate-pulse">
            <Sparkles size={20} />
          </div>
        </footer>
      </div>

      {/* Focus Bloom celebration for completed tasks */}
      <FocusBloom
        completedTasks={dayTasks}
        maxTasks={12}
        onBloomComplete={() => {
          onGubbyMessage("Focus bloom achieved! 🌸 You did wonderful today!", "excited");
        }}
      />
    </div>
  );
}
