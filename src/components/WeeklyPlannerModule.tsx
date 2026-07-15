import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Trash2, Palette } from "lucide-react";
import { Task, CalendarEvent } from "../types";
import { toLocalDateKey } from "../lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────
interface WeeklyPlannerModuleProps {
  tasks: Task[];
  onAddTask: (title: string, priority: "low"|"medium"|"high", notes?: string, scheduledDate?: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onUpdateTasksList: (updatedTasks: Task[]) => void;
  onGubbyMessage: (msg: string, mood: "happy"|"thoughtful"|"focused"|"cozy"|"excited") => void;
  manualEvents: CalendarEvent[];
  onDeleteManualEvent: (id: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PILL_COLORS = [
  { name:"None",   value:"",        bg:"",        text:"" },
  { name:"Yellow", value:"yellow",  bg:"#FFF176", text:"#33311a" },
  { name:"Green",  value:"green",   bg:"#69F0AE", text:"#1a3322" },
  { name:"Teal",   value:"teal",    bg:"#80DEEA", text:"#003333" },
  { name:"Pink",   value:"pink",    bg:"#F48FB1", text:"#3d001a" },
  { name:"Purple", value:"purple",  bg:"#CE93D8", text:"#1a003d" },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_S = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date;
}

// ─── Sub-components (defined OUTSIDE parent to prevent remount on render) ────

interface ColorPickerProps { taskId: string; activeId: string|null; onSet: (id:string, val:string)=>void; onToggle: (id:string)=>void; }
function ColorPicker({ taskId, activeId, onSet, onToggle }: ColorPickerProps) {
  return (
    <div className="relative">
      <button type="button"
        aria-label="Pick task color"
        onClick={e => { e.stopPropagation(); onToggle(taskId); }}
        className="p-1 rounded hover:bg-surface text-ink-muted hover:text-ink-2 transition-colors cursor-pointer">
        <Palette size={12} />
      </button>
      {activeId === taskId && (
        <div className="absolute right-0 bottom-full mb-1 bg-surface border border-edge rounded-xl shadow-lg flex gap-1 p-1.5 z-50">
          {PILL_COLORS.map(c => (
            <button key={c.name} type="button"
              onClick={e => { e.stopPropagation(); onSet(taskId, c.value); }}
              style={{ background: c.bg || "#fff" }}
              className="w-4 h-4 rounded-full border border-edge hover:scale-125 transition-transform cursor-pointer flex items-center justify-center text-[9px] text-ink-muted font-bold"
              title={c.name}>
              {!c.value && "×"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  key?: string | number;
  task: Task;
  dateStr: string|undefined;
  editingId: string|null;
  editTitle: string;
  colorPickerId: string|null;
  draggedId: string|null;
  dragOverTaskId: string|null;
  editRef: React.RefObject<HTMLInputElement | null>;
  onStartEdit: (task: Task) => void;
  onEditChange: (val: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onEditBlur: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onColorSet: (id: string, val: string) => void;
  onColorToggle: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDropOnTask: (e: React.DragEvent, targetId: string, dateStr: string|undefined) => void;
}
function parseItalicMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

function TaskRow({ task, dateStr, editingId, editTitle, colorPickerId, draggedId, dragOverTaskId, editRef,
  onStartEdit, onEditChange, onEditKeyDown, onEditBlur, onToggle, onDelete,
  onColorSet, onColorToggle, onDragStart, onDragOver, onDragLeave, onDropOnTask }: TaskRowProps) {
  const pill = PILL_COLORS.find(c => c.value === task.color);
  const isEditing = editingId === task.id;
  const isPlaceholder = task.title.startsWith("___") && task.title.endsWith("___");
  const cleanTitle = isPlaceholder ? task.title.slice(3, -3) : task.title;

  return (
    <div
      draggable={!isPlaceholder}
      onDragStart={e => onDragStart(e, task.id)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, task.id); }}
      onDragLeave={onDragLeave}
      onDrop={e => onDropOnTask(e, task.id, dateStr)}
      onClick={e => e.stopPropagation()}
      className={`group relative flex items-center w-full transition-colors border-b border-edge/60 ${isPlaceholder ? "opacity-40" : ""} ${dragOverTaskId === task.id ? "border-t-2 border-t-brand" : ""}`}
      style={{
        minHeight: 36,
        opacity: draggedId === task.id ? 0.3 : undefined,
      }}>

      <div className="flex-1 min-w-0 px-2 py-0.5 cursor-text"
        onClick={() => { if (!isEditing) onStartEdit(task); }}>
        {isEditing ? (
          <input
            ref={editRef}
            value={editTitle}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => onEditKeyDown(e, task.id)}
            onBlur={() => onEditBlur(task.id)}
            onClick={e => e.stopPropagation()}
            className="w-full text-sm bg-transparent outline-none text-ink font-normal"
          />
        ) : pill && pill.value ? (
          <span className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded break-words whitespace-pre-wrap ${task.completed ? "line-through opacity-40" : ""}`}
            style={{
              background: pill.bg,
              color: pill.text,
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}>
            {isPlaceholder ? (
              <span className="italic text-ink-muted font-normal">{cleanTitle}</span>
            ) : (
              parseItalicMarkdown(cleanTitle)
            )}
          </span>
        ) : (
          <span className={`text-[13px] font-normal leading-snug block break-words whitespace-pre-wrap ${task.completed ? "line-through text-ink-muted " : "text-ink-2 "}`}
            style={{
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}>
            {isPlaceholder ? (
              <span className="italic text-ink-muted font-normal">{cleanTitle}</span>
            ) : (
              parseItalicMarkdown(cleanTitle)
            )}
          </span>
        )}
      </div>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!isPlaceholder && (
          <ColorPicker taskId={task.id} activeId={colorPickerId} onSet={onColorSet} onToggle={onColorToggle} />
        )}
        <button type="button" aria-label="Delete task" onClick={e => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1 rounded hover:bg-red-50 text-ink-muted hover:text-rose-400 transition-colors cursor-pointer">
          <Trash2 size={11} />
        </button>
      </div>
      {!isPlaceholder && (
        <button type="button"
          aria-label="Toggle complete"
          onClick={e => { e.stopPropagation(); onToggle(task.id); }}
          className={`mr-1 shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
            task.completed
              ? "border-brand text-brand opacity-100"
              : "border-edge text-transparent opacity-0 group-hover:opacity-60 hover:border-brand"
          }`}>
          <Check size={10} strokeWidth={2} />
        </button>

      )}
    </div>
  );
}

interface EventRowProps { key?: string | number; evt: CalendarEvent; onDelete: (id: string) => void; }
function EventRow({ evt, onDelete }: EventRowProps) {
  return (
    <div className="group flex items-center w-full px-2 border-b border-edge/60" style={{ minHeight: 36 }}>
      <span className="text-xs mr-1.5 shrink-0">📌</span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-ink font-normal">{evt.title}</span>
        {evt.time && <span className="block text-[10px] text-brand font-mono">{evt.time}</span>}
      </div>
      <button type="button" onClick={() => onDelete(evt.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-soft text-ink-muted hover:text-danger transition-all cursor-pointer">
        <Trash2 size={11} />
      </button>
    </div>
  );
}


// ─── Add Input ────────────────────────────────────────────────────────────────
interface AddInputProps { addRef: React.RefObject<HTMLInputElement | null>; value: string; onChange: (v:string)=>void; onKeyDown: (e:React.KeyboardEvent)=>void; onBlur: ()=>void; }
function AddInput({ addRef, value, onChange, onKeyDown, onBlur }: AddInputProps) {
  return (
    <div className="flex items-center px-2" style={{ minHeight: 36, borderBottom: "1px solid #e6eee6" }}
      onClick={e => e.stopPropagation()}>
      <input
        ref={addRef}
        value={value}
        placeholder="Write task…"
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-ink-muted py-1"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function getTaskTimeBlock(task: Task): "morning" | "afternoon" | "evening" | "anytime" {
  if (!task.scheduledTime) return "anytime";
  const [hourStr] = task.scheduledTime.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return "anytime";
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "anytime";
}

export default function WeeklyPlannerModule({
  tasks, onAddTask, onDeleteTask, onToggleTask, onUpdateTask, onUpdateTasksList,
  onGubbyMessage, manualEvents, onDeleteManualEvent,
}: WeeklyPlannerModuleProps) {
  const [refDate, setRefDate] = useState(new Date());
  const [addingDate, setAddingDate] = useState<string|null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string|null>(null);
  const [draggedId, setDraggedId] = useState<string|null>(null);
  const [dragOverDate, setDragOverDate] = useState<string|null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string|null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Persistence of time block toggle state
  const [showTimeBlocks, setShowTimeBlocks] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("goblin_weekly_time_blocks") === "true";
  });
  useEffect(() => {
    localStorage.setItem("goblin_weekly_time_blocks", String(showTimeBlocks));
  }, [showTimeBlocks]);

  useEffect(() => { if (addingDate && addRef.current) addRef.current.focus(); }, [addingDate]);
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);

  const monday = getMonday(refDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });

  const headerLabel = () => {
    const s = weekDays[0], e = weekDays[6];
    if (s.getFullYear() !== e.getFullYear()) return `${MONTHS[s.getMonth()]} ${s.getFullYear()} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    if (s.getMonth() !== e.getMonth()) return `${MONTHS[s.getMonth()]} – ${MONTHS[e.getMonth()]} ${s.getFullYear()}`;
    return `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  };

  const todayStr = toLocalDateKey(new Date());
  const isToday = useCallback((d: Date) => toLocalDateKey(d) === todayStr, [todayStr]);
  const tasksFor = useCallback((ds: string) => tasks.filter(t => t.scheduledDate === ds), [tasks]);
  const somedayTasks = useCallback(() => tasks.filter(t => !t.scheduledDate), [tasks]);
  const eventsFor = useCallback((ds: string) => (manualEvents||[]).filter(e => e.date === ds), [manualEvents]);

  const commitAdd = useCallback((dateStr: string) => {
    if (newTitle.trim()) {
      onAddTask(newTitle.trim(), "medium", "Added in Weekly Planner", dateStr === "someday" ? undefined : dateStr);
      onGubbyMessage("Task added! 📝", "happy");
    }
    setNewTitle(""); setAddingDate(null);
  }, [newTitle, onAddTask, onGubbyMessage]);

  const onStartEdit = useCallback((task: Task) => { setEditingId(task.id); setEditTitle(task.title); }, []);
  const onEditChange = useCallback((val: string) => setEditTitle(val), []);
  const onEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
    else if (e.key === "Escape") setEditingId(null);
  }, []);
  const onEditBlur = useCallback((id: string) => {
    if (editTitle.trim()) onUpdateTask(id, { title: editTitle.trim() }); else onDeleteTask(id); setEditingId(null);
  }, [editTitle, onUpdateTask, onDeleteTask]);

  const onColorSet = useCallback((id: string, val: string) => { onUpdateTask(id, { color: val || undefined }); setColorPickerId(null); }, [onUpdateTask]);
  const onColorToggle = useCallback((id: string) => setColorPickerId(prev => prev === id ? null : id), []);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => { e.dataTransfer.setData("text/plain", id); setDraggedId(id); }, []);
  const onDragOver = useCallback((e: React.DragEvent, ds: string) => { e.preventDefault(); setDragOverDate(ds); }, []);
  const onDragLeaveHandler = useCallback(() => { setDragOverDate(null); setDragOverTaskId(null); }, []);
  const onDragOverTask = useCallback((e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverTaskId(id); }, []);
  
  const onDrop = useCallback((e: React.DragEvent, targetDate: string|undefined, targetTime?: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverDate(null); setDragOverTaskId(null);
    if (id) {
      onUpdateTask(id, { 
        scheduledDate: targetDate,
        scheduledTime: targetTime
      });
    }
    setDraggedId(null);
  }, [draggedId, onUpdateTask]);

  const onDropOnTask = useCallback((e: React.DragEvent, targetTaskId: string, targetDate: string|undefined, targetTime?: string) => {
    e.preventDefault(); e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverDate(null); setDragOverTaskId(null);
    if (!id || id === targetTaskId) return;
    const updated = [...tasks];
    const di = updated.findIndex(t => t.id === id);
    if (di === -1) return;
    const [item] = updated.splice(di, 1);
    item.scheduledDate = targetDate;
    if (targetTime !== undefined) {
      item.scheduledTime = targetTime;
    }
    const ti = updated.findIndex(t => t.id === targetTaskId);
    if (ti === -1) return;
    updated.splice(ti, 0, item);
    onUpdateTasksList(updated);
    setDraggedId(null);
  }, [draggedId, tasks, onUpdateTasksList]);

  const commonTaskProps = {
    editingId, editTitle, colorPickerId, draggedId, dragOverTaskId, editRef,
    onStartEdit, onEditChange, onEditKeyDown, onEditBlur,
    onToggle: onToggleTask, onDelete: onDeleteTask,
    onColorSet, onColorToggle,
    onDragStart, onDragOver: onDragOverTask, onDragLeave: onDragLeaveHandler, onDropOnTask,
  };

  // Render a day column
  const renderColumn = (opts: {
    label: string; sublabel: string; dateStr: string;
    today: boolean; lines?: number;
  }) => {
    const { label, sublabel, dateStr, today, lines = 10 } = opts;
    const isSomeday = dateStr === "someday";
    const isAdding = addingDate === dateStr;
    const dayTasks = isSomeday ? somedayTasks() : tasksFor(dateStr);
    const dayEvents = isSomeday ? [] : eventsFor(dateStr);
    const rendered = dayEvents.length + dayTasks.length + (isAdding ? 1 : 0);
    const empty = Math.max(0, lines - rendered);
    const underline = today ? "#F27D26" : "#CDE0CD";
    const titleColor = today ? "#F27D26" : "#1A261A";
    const subColor = today ? "#F27D26" : "#556B55";

    // Snapping time block tasks
    const morningTasks = dayTasks.filter(t => getTaskTimeBlock(t) === "morning");
    const afternoonTasks = dayTasks.filter(t => getTaskTimeBlock(t) === "afternoon");
    const eveningTasks = dayTasks.filter(t => getTaskTimeBlock(t) === "evening");
    const anytimeTasks = dayTasks.filter(t => getTaskTimeBlock(t) === "anytime");

    return (
      <div key={dateStr} className="flex flex-col min-w-0 flex-1"
        onDragOver={e => { if (!showTimeBlocks) onDragOver(e, dateStr); }}
        onDragLeave={onDragLeaveHandler}
        onDrop={e => { if (!showTimeBlocks) onDrop(e, isSomeday ? undefined : dateStr); }}
        onClick={() => { setAddingDate(dateStr); setNewTitle(""); setEditingId(null); }}
        style={{ background: dragOverDate === dateStr ? "rgba(248,250,252,0.8)" : "transparent" }}>

        {/* Header */}
        <div className="flex items-baseline justify-between pb-1 select-none"
          style={{ borderBottom: `2px solid ${underline}` }}>
          <span className="text-[15px] font-semibold" style={{ color: titleColor, fontFamily: "'Fredoka', 'Nunito', sans-serif" }}>{label}</span>
          <span className="text-[11px] font-normal" style={{ color: subColor }}>{sublabel}</span>
        </div>

        {/* Content */}
        {showTimeBlocks && !isSomeday ? (
          <div className="flex flex-col w-full gap-2 mt-2" onClick={e => e.stopPropagation()}>
            {/* Events */}
            {dayEvents.length > 0 && (
              <div className="space-y-1">
                {dayEvents.map(evt => <EventRow key={evt.id} evt={evt} onDelete={id => { onDeleteManualEvent(id); onGubbyMessage("Event removed! 💨","cozy"); }} />)}
              </div>
            )}

            {/* Morning */}
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverDate(`${dateStr}:morning`); }}
              onDragLeave={onDragLeaveHandler}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e, dateStr, "09:00"); }}
              className={`transition-colors rounded-xl p-1.5 border-2 ${
                dragOverDate === `${dateStr}:morning` ? "bg-[#FEFCE8] border-[#FEF08A]/80 shadow-sm" : "bg-[#FEFCE8]/45 border-[#FEF08A]/25"
              }`}
            >
              <div className="text-[9px] font-extrabold text-[#A16207] uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                <span>☀️</span> Morning
              </div>
              <div className="space-y-0.5">
                {morningTasks.map(task => (
                  <TaskRow key={task.id} task={task} dateStr={dateStr} {...commonTaskProps} onDropOnTask={(e, targetId, date) => onDropOnTask(e, targetId, date, "09:00")} />
                ))}
                {morningTasks.length === 0 && (
                  <div className="text-[8px] italic text-[#A16207]/40 py-1 text-center border border-dashed border-[#FEF08A]/10 rounded-lg select-none">
                    Empty ☀️
                  </div>
                )}
              </div>
            </div>

            {/* Afternoon */}
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverDate(`${dateStr}:afternoon`); }}
              onDragLeave={onDragLeaveHandler}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e, dateStr, "13:00"); }}
              className={`transition-colors rounded-xl p-1.5 border-2 ${
                dragOverDate === `${dateStr}:afternoon` ? "bg-[#F0FDF4] border-[#BBF7D0]/80 shadow-sm" : "bg-[#F0FDF4]/45 border-[#BBF7D0]/25"
              }`}
            >
              <div className="text-[9px] font-extrabold text-[#15803D] uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                <span>🌤️</span> Afternoon
              </div>
              <div className="space-y-0.5">
                {afternoonTasks.map(task => (
                  <TaskRow key={task.id} task={task} dateStr={dateStr} {...commonTaskProps} onDropOnTask={(e, targetId, date) => onDropOnTask(e, targetId, date, "13:00")} />
                ))}
                {afternoonTasks.length === 0 && (
                  <div className="text-[8px] italic text-[#15803D]/40 py-1 text-center border border-dashed border-[#BBF7D0]/10 rounded-lg select-none">
                    Empty 🌤️
                  </div>
                )}
              </div>
            </div>

            {/* Evening */}
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverDate(`${dateStr}:evening`); }}
              onDragLeave={onDragLeaveHandler}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e, dateStr, "18:00"); }}
              className={`transition-colors rounded-xl p-1.5 border-2 ${
                dragOverDate === `${dateStr}:evening` ? "bg-[#FDF4FF] border-[#F5D0FE]/80 shadow-sm" : "bg-[#FDF4FF]/45 border-[#F5D0FE]/25"
              }`}
            >
              <div className="text-[9px] font-extrabold text-[#701A75] uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                <span>🌙</span> Evening
              </div>
              <div className="space-y-0.5">
                {eveningTasks.map(task => (
                  <TaskRow key={task.id} task={task} dateStr={dateStr} {...commonTaskProps} onDropOnTask={(e, targetId, date) => onDropOnTask(e, targetId, date, "18:00")} />
                ))}
                {eveningTasks.length === 0 && (
                  <div className="text-[8px] italic text-[#701A75]/40 py-1 text-center border border-dashed border-[#F5D0FE]/10 rounded-lg select-none">
                    Empty 🌙
                  </div>
                )}
              </div>
            </div>

            {/* Anytime */}
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverDate(`${dateStr}:anytime`); }}
              onDragLeave={onDragLeaveHandler}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e, dateStr, undefined); }}
              className={`transition-colors rounded-xl p-1.5 border-2 ${
                dragOverDate === `${dateStr}:anytime` ? "bg-slate-50 border-slate-200 shadow-sm" : "bg-surface-sunken/40 border-edge "
              }`}
            >
              <div className="text-[9px] font-extrabold text-[#475569] uppercase tracking-wider mb-1 select-none flex items-center gap-1">
                <span>📅</span> Anytime
              </div>
              <div className="space-y-0.5">
                {anytimeTasks.map(task => (
                  <TaskRow key={task.id} task={task} dateStr={dateStr} {...commonTaskProps} onDropOnTask={(e, targetId, date) => onDropOnTask(e, targetId, date, undefined)} />
                ))}
                {anytimeTasks.length === 0 && (
                  <div className="text-[8px] italic text-[#475569]/30 py-1 text-center border border-dashed border-edge rounded-lg select-none">
                    Anytime 📅
                  </div>
                )}
              </div>
            </div>

            {isAdding && (
              <AddInput
                addRef={addRef}
                value={newTitle}
                onChange={setNewTitle}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); if (newTitle.trim()) { onAddTask(newTitle.trim(), "medium", "Added in Weekly Planner", dateStr); setNewTitle(""); setAddingDate(null); onGubbyMessage("Task added! 📝","happy"); } else setAddingDate(null); }
                  else if (e.key === "Escape") { setAddingDate(null); setNewTitle(""); }
                }}
                onBlur={() => commitAdd(dateStr)}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {dayEvents.map(evt => <EventRow key={evt.id} evt={evt} onDelete={id => { onDeleteManualEvent(id); onGubbyMessage("Event removed! 💨","cozy"); }} />)}
            {dayTasks.map(task => <TaskRow key={task.id} task={task} dateStr={isSomeday ? undefined : dateStr} {...commonTaskProps} />)}
            {isAdding && (
              <AddInput
                addRef={addRef}
                value={newTitle}
                onChange={setNewTitle}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); if (newTitle.trim()) { onAddTask(newTitle.trim(), "medium", "Added in Weekly Planner", isSomeday ? undefined : dateStr); setNewTitle(""); setAddingDate(null); onGubbyMessage("Task added! 📝","happy"); } else setAddingDate(null); }
                  else if (e.key === "Escape") { setAddingDate(null); setNewTitle(""); }
                }}
                onBlur={() => commitAdd(dateStr)}
              />
            )}
            {/* Empty rows */}
            {Array.from({ length: empty }).map((_, i) => (
              <div key={i} style={{ minHeight: 36, borderBottom: "1px solid #e6eee6" }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const [mon, tue, wed, thu, fri, sat, sun] = weekDays;
  const fmtLabel = (d: Date) => `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
  const fmtSub = (d: Date) => DAYS_S[d.getDay()];

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", fontFamily: "'Fredoka', 'Nunito', sans-serif" }}>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-3xl font-bold tracking-tight leading-none select-none" style={{ color: "#1A261A", fontFamily: "'Fredoka', 'Nunito', sans-serif" }}>
          {headerLabel()}
        </h1>
        <div className="flex items-center gap-3">
          {/* Toggle Time Blocks */}
          <button
            onClick={() => {
              setShowTimeBlocks(prev => !prev);
              onGubbyMessage(
                !showTimeBlocks ? "Time blocks activated! Snap your tasks to morning, afternoon, or evening ☀️" : "Time blocks off. Flat view activated!",
                "cozy"
              );
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
              showTimeBlocks
                ? "bg-brand text-white shadow-xs border-2 border-brand"
                : "bg-surface-sunken  text-ink-muted  border-2 border-edge-soft  hover:bg-surface "
            }`}
          >
            ⏱️ Time Blocks: {showTimeBlocks ? "ON" : "OFF"}
          </button>

          <div className="flex items-center gap-2">
            <button id="prev-week-btn" type="button"
              onClick={() => { const d = new Date(refDate); d.setDate(d.getDate()-7); setRefDate(d); onGubbyMessage("Back a week! 🕰️","thoughtful"); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-colors cursor-pointer" style={{ background: "#2D3A2D" }}>
              <ChevronLeft size={16} />
            </button>
            <button id="next-week-btn" type="button"
              onClick={() => { const d = new Date(refDate); d.setDate(d.getDate()+7); setRefDate(d); onGubbyMessage("Forward a week! 🚀","happy"); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-colors cursor-pointer" style={{ background: "#2D3A2D" }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: 7-column grid — flat, full-width, no vertical borders */}
      <div className="hidden lg:flex">
        {[mon, tue, wed, thu, fri].map((d) => (
          <div key={toLocalDateKey(d)} className="flex-1 min-w-0 px-3 pt-3">
            {renderColumn({ label: fmtLabel(d), sublabel: fmtSub(d), dateStr: toLocalDateKey(d), today: isToday(d), lines: 12 })}
          </div>
        ))}
        {/* Sat + Sun stacked in last column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-3 pt-3 flex-1" style={{ borderBottom: "1px solid #efefef" }}>
            {renderColumn({ label: fmtLabel(sat), sublabel: fmtSub(sat), dateStr: toLocalDateKey(sat), today: isToday(sat), lines: 5 })}
          </div>
          <div className="px-3 pt-3 flex-1">
            {renderColumn({ label: fmtLabel(sun), sublabel: fmtSub(sun), dateStr: toLocalDateKey(sun), today: isToday(sun), lines: 5 })}
          </div>
        </div>
      </div>

      {/* Desktop: Someday strip */}
      <div className="hidden lg:block mt-2" style={{ borderTop: "1px solid #e8e8e8" }}
        onDragOver={e => onDragOver(e, "someday")}
        onDragLeave={onDragLeaveHandler}
        onDrop={e => onDrop(e, undefined)}
        onClick={() => { setAddingDate("someday"); setNewTitle(""); setEditingId(null); }}>
        <div className="px-3 pt-3 pb-1">
          <span className="text-[13px] font-normal select-none" style={{ color: "#556B55" }}>Someday</span>
        </div>
        <div className="px-3 pb-6">
          {somedayTasks().map(task => <TaskRow key={task.id} task={task} dateStr={undefined} {...commonTaskProps} />)}
          {addingDate === "someday" && (
            <AddInput addRef={addRef} value={newTitle} onChange={setNewTitle}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); if (newTitle.trim()) { onAddTask(newTitle.trim(),"medium","Added in Weekly Planner",undefined); setNewTitle(""); onGubbyMessage("Task added! 📝","happy"); } else setAddingDate(null); }
                else if (e.key === "Escape") { setAddingDate(null); setNewTitle(""); }
              }}
              onBlur={() => commitAdd("someday")} />
          )}
          {Array.from({ length: 3 }).map((_,j) => <div key={j} style={{ minHeight: 36, borderBottom: "1px solid #e6eee6" }} />)}
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="flex flex-col lg:hidden px-4 pb-8 gap-5">
        {weekDays.map((d) => {
          const ds = toLocalDateKey(d);
          return (
            <div key={ds} className="bg-surface rounded-2xl border border-edge-soft/60 p-4 shadow-sm">
              {renderColumn({ label: fmtLabel(d), sublabel: fmtSub(d), dateStr: ds, today: isToday(d), lines: 5 })}
            </div>
          );
        })}
        <div className="bg-surface rounded-2xl border border-edge-soft/60 p-4 shadow-sm">
          {renderColumn({ label: "Someday", sublabel: "Backlog", dateStr: "someday", today: false, lines: 5 })}
        </div>
      </div>
    </div>
  );
}
