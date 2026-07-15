import React, { useState, useRef, useEffect, useMemo } from "react";
import { Sparkles, Play, Calendar, Trash2, Check, Plus, AlertCircle, ChevronDown, ChevronUp, Clock, Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, SubTask } from "../types";
import { estimateTaskDuration, toLocalDateKey, getTaskSize, PRIORITY_CHIP } from "../lib/constants";
import { useSpeechRecognition } from "../lib/useSpeechRecognition";
import { useToast } from "./Toast";
import { breakdownTask } from "../lib/goblin-api.functions";

interface MagicTodoModuleProps {
  tasks: Task[];
  onAddTask: (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string, estimatedMinutes?: number) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onFocusAndSwitch?: (taskTitle: string, taskId?: string) => void;
  onGainXp?: (amount: number) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export default function MagicTodoModule({
  tasks,
  onAddTask,
  onDeleteTask,
  onToggleTask,
  onUpdateTask,
  onFocusTask,
  onFocusAndSwitch,
  onGainXp,
  onGubbyMessage,
  selectedDate,
  onSelectDate
}: MagicTodoModuleProps) {
  const { pushToast } = useToast();
  // Filter for the list: "date", "all", or "someday"
  const [listFilter, setListFilter] = useState<"date" | "all" | "someday">("date");

  // Input form state
  const [newTitle, setNewTitle] = useState("");
  const [priorityVal, setPriorityVal] = useState<number>(2); // 1 = low, 2 = medium, 3 = high
  const [formError, setFormError] = useState<string | null>(null);

  // Expanded task IDs to view nested subtasks
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Collapsed task card controls — show minimal view by default
  const [expandedControlIds, setExpandedControlIds] = useState<Record<string, boolean>>({});
  const toggleControls = (id: string) => setExpandedControlIds(prev => ({ ...prev, [id]: !prev[id] }));

  // Scheduler popup state
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Ref + focus management for the scheduling modal dialog
  const scheduleDialogRef = useRef<HTMLDivElement>(null);

  // Loading state for breakdown API calls
  const [breakingDownTaskIds, setBreakingDownTaskIds] = useState<Record<string, boolean>>({});

  // Interactive priority dropdown state
  const [openPriorityMenuId, setOpenPriorityMenuId] = useState<string | null>(null);

  // Interactive custom clock picker state
  const [openClockPickerId, setOpenClockPickerId] = useState<string | null>(null);

  // Individual task manual subtask inputs
  const [manualSubtaskInputs, setManualSubtaskInputs] = useState<Record<string, string>>({});

  // Voice: dictate the task title, or say "add <task>" to create it directly.
  const speech = useSpeechRecognition((text) => {
    const lower = text.toLowerCase();
    if (lower.startsWith("add ") || lower.startsWith("new ")) {
      const title = text.slice(text.indexOf(" ") + 1).trim();
      if (title) {
        const pr = priorityVal === 1 ? "low" : priorityVal === 3 ? "high" : "medium";
        onAddTask(title, pr, undefined, activeDate, estimateTaskDuration(title));
        onGubbyMessage(`Sprig heard "${title}" — added by voice! 🎤`, "happy");
      }
    } else {
      setNewTitle((prev) => (prev ? `${prev} ${text}` : text));
    }
  });



  const handlePriorityChange = (val: number) => {
    setPriorityVal(val);
    if (val === 1) {
      onGubbyMessage("Low pressure! Easy start, we can get this done in a snap!", "happy");
    } else if (val === 2) {
      onGubbyMessage("Medium effort! Requires a bit of focus juice.", "thoughtful");
    } else {
      onGubbyMessage("High priority! 🎯 This is a key item. Breaking it down is highly recommended!", "excited");
    }
  };

  const y = new Date().getFullYear(); const m = String(new Date().getMonth()+1).padStart(2,'0'); const d = String(new Date().getDate()).padStart(2,'0'); const todayStr = `${y}-${m}-${d}`;
  const activeDate = selectedDate || todayStr;

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("What is your mission? Please write a name first!");
      return;
    }

    const priorityMap: Record<number, "low" | "medium" | "high"> = {
      1: "low",
      2: "medium",
      3: "high"
    };

    const targetDate = listFilter === "date" ? activeDate : (listFilter === "someday" ? undefined : todayStr);
    const calculatedEstimate = estimateTaskDuration(newTitle.trim());
    onAddTask(newTitle.trim(), priorityMap[priorityVal], undefined, targetDate, calculatedEstimate);
    
    if (targetDate) {
      onGubbyMessage(
        `Added: "${newTitle.trim()}" for ${targetDate}! Magic Estimate: ${calculatedEstimate}m. Let's handle it step-by-step!`,
        "happy"
      );
    } else {
      onGubbyMessage(
        `Added: "${newTitle.trim()}" to your Someday ideas backlog!`,
        "happy"
      );
    }
    
    // Reset Form
    setNewTitle("");
    setPriorityVal(2);
    setFormError(null);
  };

  const handleToggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Keep the latest tasks array reachable inside long-running async handlers
  // so post-await guards see current data instead of a stale render snapshot.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Slices a task down using API breakdown
  const handleBreakItDown = async (task: Task) => {
    setBreakingDownTaskIds(prev => ({ ...prev, [task.id]: true }));
    onGubbyMessage(`Slicing "${task.title}" into micro-movements so it's less scary!`, "focused");

    try {
      const data = await breakdownTask({ data: { title: task.title, priority: task.priority } });
      const generatedSteps: string[] = data.steps || [];

      const newSubtasks: SubTask[] = generatedSteps.map((step, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: step,
        completed: false
      }));

      // Look up the CURRENT task (not the captured snapshot) — subtasks added
      // manually while the breakdown request was in flight would otherwise
      // be discarded by the overwrite below.
      const currentTask = tasksRef.current.find(t => t.id === task.id);
      if (!currentTask) return; // task was deleted mid-request

      onUpdateTask(task.id, { subtasks: [...currentTask.subtasks, ...newSubtasks] });

      // Auto expand to see result
      setExpandedTaskIds(prev => ({ ...prev, [task.id]: true }));
      onGubbyMessage(`Boom! Sliced into ${generatedSteps.length} micro-steps. Take a look!`, "excited");
    } catch (err: unknown) {
      console.error(err);
      onGubbyMessage("Sprig couldn't slice this task automatically. Let's write subtasks manually!", "cozy");
    } finally {
      setBreakingDownTaskIds(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleAddManualSubtask = (taskId: string) => {
    const text = manualSubtaskInputs[taskId] || "";
    if (!text.trim()) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSub: SubTask = {
      id: `sub-manual-${Date.now()}`,
      title: text.trim(),
      completed: false
    };

    onUpdateTask(taskId, { subtasks: [...task.subtasks, newSub] });
    setManualSubtaskInputs(prev => ({ ...prev, [taskId]: "" }));
    setExpandedTaskIds(prev => ({ ...prev, [taskId]: true }));
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(sub => {
      if (sub.id === subtaskId) {
        return { ...sub, completed: !sub.completed };
      }
      return sub;
    });

    onUpdateTask(taskId, { subtasks: updatedSubtasks });
    
    // Check if all subtasks are finished, offer encouragement
    const newlyCompleted = updatedSubtasks.find(s => s.id === subtaskId)?.completed;
    if (newlyCompleted) {
      onGubbyMessage("Yay! Micro-step completed! You are rolling!", "happy");
      onGainXp?.(3);
    } else {
      onGainXp?.(-3);
    }
  };

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    onUpdateTask(taskId, {
      subtasks: task.subtasks.filter(sub => sub.id !== subtaskId)
    });
  };

  const handleOpenSchedule = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setSchedulingTaskId(taskId);
    setScheduleDate(task.scheduledDate || "");
    setScheduleTime(task.scheduledTime || "");
    setScheduleError(null);
  };

  const handleSaveSchedule = () => {
    if (!schedulingTaskId) return;
    if (!scheduleDate) {
      setScheduleError("Please select a date!");
      return;
    }

    onUpdateTask(schedulingTaskId, {
      scheduledDate: scheduleDate,
      scheduledTime: scheduleTime || undefined
    });

    onGubbyMessage("Task scheduled on your calendar successfully! 📅", "happy");
    setSchedulingTaskId(null);
  };

  // Scheduling modal: focus management + Escape-to-close
  useEffect(() => {
    if (!schedulingTaskId) return;
    const dialog = scheduleDialogRef.current;
    if (dialog) dialog.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSchedulingTaskId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [schedulingTaskId]);

  const getPriorityLabel = (priority: "low" | "medium" | "high") => {
    switch (priority) {
      case "low": return "🟢";
      case "medium": return "🟡";
      case "high": return "🔴";
    }
  };

  // Memoized so keystrokes in unrelated inputs don't re-run an O(N log N)
  // filter+sort over the full task list on every render.
  const filteredTasks = useMemo(() => {
    const priorityWeight: Record<Task["priority"], number> = { high: 1, medium: 2, low: 3 };
    return tasks
      .filter(t => {
        if (listFilter === "date") return t.scheduledDate === activeDate;
        if (listFilter === "someday") return !t.scheduledDate;
        return true;
      })
      .sort((a, b) => {
        // Uncompleted first, then priority high → low.
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
      });
  }, [tasks, listFilter, activeDate]);

  // Today's top 3: uncompleted, today-scheduled, sorted by priority.
  const todayStr2 = toLocalDateKey();
  const top3Today = useMemo(() => {
    const w: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter(t => !t.completed && t.scheduledDate === todayStr2)
      .sort((a, b) => w[a.priority] - w[b.priority])
      .slice(0, 3);
  }, [tasks, todayStr2]);

  // Header stats
  const totalActive = tasks.filter(t => !t.completed).length;
  const doneToday = tasks.filter(t => t.completed && t.scheduledDate === todayStr2).length;
  const todayTotal = tasks.filter(t => t.scheduledDate === todayStr2).length;
  const todayPct = todayTotal > 0 ? Math.round((doneToday / todayTotal) * 100) : 0;
  const hero = top3Today[0];

  return (
    <div id="magic-todo-module" className="max-w-5xl mx-auto px-1 sm:px-0 pb-8">

      {/* ── HEADER STRIP: identity + today's progress bar ─────────── */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Today · {todayStr2}</div>
            <h1 className="text-2xl sm:text-3xl font-fredoka font-bold text-ink truncate">Quest Log</h1>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-2xl sm:text-3xl font-bold text-brand tabular-nums leading-none">{todayPct}<span className="text-sm text-ink-muted">%</span></div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mt-1">{doneToday}/{todayTotal} done</div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-surface-sunken rounded-full overflow-hidden border border-edge-soft">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${todayPct}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
            className="h-full bg-gradient-to-r from-brand to-brand-hover rounded-full"
            style={{ boxShadow: "var(--theme-glow)" }}
          />
        </div>
      </div>

      {/* ── HERO: what to do RIGHT NOW ───────────────────────────── */}
      <AnimatePresence mode="wait">
        {hero && (
          <motion.div
            key={hero.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative overflow-hidden bg-surface-sunken border border-edge rounded-2xl p-5 sm:p-6 mb-5 card-shadow"
            style={{ boxShadow: "var(--theme-glow)" }}
          >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-hover" />
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" /> Next Up
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl font-fredoka font-bold text-ink leading-tight break-words">
                  {hero.title}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted font-semibold">
                  <span className="flex items-center gap-1"><Clock size={12} />{hero.estimatedMinutes ?? estimateTaskDuration(hero.title)}m</span>
                  <span>·</span>
                  <span className="capitalize">{getPriorityLabel(hero.priority)} {hero.priority}</span>
                  {top3Today.length > 1 && <><span>·</span><span>+{top3Today.length - 1} queued</span></>}
                </div>
              </div>
              <button
                onClick={() => {
                  onFocusTask(hero.title, undefined, hero.id);
                  if (onFocusAndSwitch) onFocusAndSwitch(hero.title, hero.id);
                  onGubbyMessage(`Starting "${hero.title}"! You've got this 🎯`, "focused");
                }}
                className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-primary-foreground font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
                style={{ boxShadow: "var(--theme-glow)" }}
              >
                <Play size={14} className="fill-current" /> Start focus
              </button>
            </div>
            {top3Today.length > 1 && (
              <div className="mt-4 pt-3 border-t border-edge-soft flex flex-wrap gap-2">
                {top3Today.slice(1).map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onFocusTask(t.title, undefined, t.id);
                      if (onFocusAndSwitch) onFocusAndSwitch(t.title, t.id);
                    }}
                    className="text-xs font-semibold text-ink-muted hover:text-ink bg-surface border border-edge-soft hover:border-brand/40 rounded-lg px-2.5 py-1 transition-all cursor-pointer truncate max-w-[240px]"
                    title={`#${i + 2}: ${t.title}`}
                  >
                    <span className="text-brand mr-1 font-bold">#{i + 2}</span>{t.title}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMPOSER: inline pill row ─────────────────────────────── */}
      <form onSubmit={handleAddTaskSubmit} className="mb-5">
        <div className="group flex items-stretch gap-0 bg-surface-sunken border border-edge rounded-2xl overflow-hidden focus-within:border-brand transition-colors">
          <div className="flex items-center pl-4 text-ink-muted">
            <Plus size={18} />
          </div>
          <input
            id="todo-title-input"
            type="text"
            value={newTitle}
            onChange={(e) => { setNewTitle(e.target.value); if (formError) setFormError(null); }}
            placeholder="Add a quest… what feels too big?"
            className="flex-1 min-w-0 px-3 py-3.5 bg-transparent outline-none font-nunito text-ink placeholder:text-ink-muted/70 text-base"
          />
          {/* priority pills */}
          <div className="hidden sm:flex items-center gap-1 px-2 border-l border-edge-soft">
            {[1, 2, 3].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => handlePriorityChange(v)}
                className={`w-8 h-8 rounded-lg text-base transition-all cursor-pointer ${priorityVal === v ? "bg-brand-soft scale-110" : "hover:bg-surface"}`}
                title={v === 1 ? "Low" : v === 2 ? "Medium" : "High"}
              >
                {v === 1 ? "🟢" : v === 2 ? "🟡" : "🔴"}
              </button>
            ))}
          </div>
          {speech.supported && (
            <button
              type="button"
              id="todo-mic-btn"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              className={`px-3 border-l border-edge-soft transition-colors cursor-pointer ${speech.listening ? "bg-brand text-primary-foreground animate-pulse" : "text-ink-muted hover:text-brand"}`}
              title={speech.listening ? "Stop dictation" : "Dictate"}
            >
              {speech.listening ? <Square size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            id="add-todo-btn"
            type="submit"
            className="px-5 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-sm transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
        {/* mobile priority row */}
        <div className="sm:hidden mt-2 flex items-center gap-1">
          {[1, 2, 3].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => handlePriorityChange(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer border ${priorityVal === v ? "bg-brand-soft border-brand/40 text-ink" : "border-edge-soft text-ink-muted"}`}
            >
              {v === 1 ? "🟢 Low" : v === 2 ? "🟡 Med" : "🔴 High"}
            </button>
          ))}
        </div>
        {formError ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-danger font-semibold">
            <AlertCircle size={14} /> {formError}
          </div>
        ) : newTitle.trim() && (
          <div className="mt-2 text-[11px] text-ink-muted font-semibold flex items-center gap-1.5">
            <Sparkles size={11} className="text-brand" /> Auto-estimate: <span className="font-mono text-brand">{estimateTaskDuration(newTitle)}m</span>
          </div>
        )}
      </form>

      {/* ── FILTER BAR: segmented + date + sweep ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex bg-surface-sunken border border-edge rounded-xl p-0.5">
          {([
            { k: "date", label: "Date" },
            { k: "all", label: "All" },
            { k: "someday", label: "Someday" },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setListFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${listFilter === k ? "bg-brand text-primary-foreground" : "text-ink-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {listFilter === "date" && (
          <input
            id="magic-todo-date-picker"
            type="date"
            value={activeDate}
            onChange={(e) => e.target.value && onSelectDate(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand cursor-pointer"
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
            {filteredTasks.length} · {totalActive} active
          </span>
          {tasks.filter(t => t.completed).length > 0 && (
            <button
              id="clear-completed-todo-btn"
              onClick={() => {
                tasks.filter(t => t.completed).forEach(t => onDeleteTask(t.id));
                pushToast({ icon: "🧹", message: "Completed quests swept away", tone: "info" });
              }}
              className="text-[11px] text-ink-muted hover:text-danger font-bold border border-edge hover:border-danger/40 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              Sweep done
            </button>
          )}
        </div>
      </div>

      {/* ── TASK LIST: slim rows w/ accent stripe ────────────────── */}
      {filteredTasks.length === 0 ? (
        <div className="bg-surface-sunken border border-dashed border-edge rounded-2xl py-14 text-center">
          <div className="text-4xl mb-2 opacity-60">🌿</div>
          <p className="text-ink font-fredoka font-bold text-base">
            {tasks.length === 0 ? "Your quest board is clear" : listFilter === "date" ? `Nothing scheduled for ${activeDate}` : "No quests match this view"}
          </p>
          <p className="text-ink-muted text-xs mt-1 font-semibold">Type above to add your first mission ✨</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredTasks.map((task) => {
            const completedSubs = task.subtasks.filter(s => s.completed).length;
            const totalSubs = task.subtasks.length;
            const subPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
            const isExpanded = !!expandedTaskIds[task.id];
            const controlsExpanded = !!expandedControlIds[task.id];
            const estMin = task.estimatedMinutes ?? estimateTaskDuration(task.title);
            const stripe = task.completed ? "bg-edge-soft" : task.priority === "high" ? "bg-danger" : task.priority === "medium" ? "bg-warn" : "bg-success";

            return (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative bg-surface-sunken border border-edge rounded-xl overflow-hidden transition-all hover:border-brand/40 ${task.completed ? "opacity-60" : ""}`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />

                {/* Row */}
                <div className="pl-4 pr-2 sm:pr-3 py-3 flex items-center gap-3">
                  <button
                    id={`todo-checkbox-${task.id}`}
                    role="checkbox"
                    aria-checked={task.completed}
                    aria-label={`Toggle "${task.title}"`}
                    onClick={() => onToggleTask(task.id)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${task.completed ? "bg-brand border-brand text-primary-foreground" : "border-edge-strong hover:border-brand bg-surface"}`}
                  >
                    {task.completed && <Check size={14} strokeWidth={3} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm sm:text-[15px] font-semibold text-ink font-fredoka leading-snug truncate ${task.completed ? "line-through" : ""}`}>
                      {task.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted font-semibold">
                      <span className="font-mono">{estMin}m</span>
                      {task.scheduledTime && <><span>·</span><span>@ {task.scheduledTime}</span></>}
                      {totalSubs > 0 && <><span>·</span><span className="text-brand">{completedSubs}/{totalSubs} steps</span></>}
                      {task.scheduledDate && listFilter !== "date" && <><span>·</span><span>{task.scheduledDate}</span></>}
                    </div>
                    {totalSubs > 0 && (
                      <div className="mt-1.5 h-1 w-full bg-surface rounded-full overflow-hidden">
                        <div className="h-full bg-brand transition-all" style={{ width: `${subPercent}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!task.completed && (
                      <button
                        id={`focus-btn-quick-${task.id}`}
                        onClick={() => {
                          onFocusTask(task.title, undefined, task.id);
                          if (onFocusAndSwitch) onFocusAndSwitch(task.title, task.id);
                          onGubbyMessage(`Loading "${task.title}" into Focus Timer!`, "focused");
                        }}
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-brand hover:bg-brand-hover text-primary-foreground text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer"
                      >
                        <Play size={11} className="fill-current" /> Focus
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleExpand(task.id)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
                      title="Steps"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => toggleControls(task.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${controlsExpanded ? "text-brand bg-brand-soft/30" : "text-ink-muted hover:text-ink hover:bg-surface"}`}
                      title="More"
                    >
                      <span className="text-sm font-bold leading-none">···</span>
                    </button>
                  </div>
                </div>

                {/* Extra controls row */}
                <AnimatePresence>
                  {controlsExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-edge-soft"
                    >
                      <div className="pl-4 pr-3 py-2.5 flex flex-wrap items-center gap-2 bg-surface/30">
                        {/* priority menu */}
                        <div className="relative">
                          <button
                            id={`priority-btn-${task.id}`}
                            onClick={(e) => { e.stopPropagation(); setOpenPriorityMenuId(openPriorityMenuId === task.id ? null : task.id); }}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${getBadgeClass(task.priority)}`}
                          >
                            {getPriorityLabel(task.priority)} <span className="capitalize">{task.priority}</span>
                          </button>
                          {openPriorityMenuId === task.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenPriorityMenuId(null)} />
                              <div className="absolute left-0 top-full mt-1 bg-surface border border-edge rounded-xl shadow-xl z-50 p-1 min-w-[130px]">
                                {(["low", "medium", "high"] as const).map(lvl => (
                                  <button
                                    key={lvl}
                                    onClick={() => { onUpdateTask(task.id, { priority: lvl }); setOpenPriorityMenuId(null); }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${task.priority === lvl ? "bg-brand-soft/40 text-ink" : "text-ink-muted hover:bg-surface-sunken"}`}
                                  >
                                    {getPriorityLabel(lvl)} <span className="capitalize">{lvl}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* estimate stepper */}
                        <div className="inline-flex items-center bg-surface border border-edge-soft rounded-lg">
                          <button
                            onClick={() => { const n = Math.max(5, estMin - 5); onUpdateTask(task.id, { estimatedMinutes: n }); }}
                            className="px-2 py-1 text-brand font-bold hover:bg-brand-soft/30 rounded-l-lg cursor-pointer"
                          >−</button>
                          <button
                            onClick={() => setOpenClockPickerId(openClockPickerId === task.id ? null : task.id)}
                            className="px-2 py-1 text-xs font-bold font-mono text-ink hover:text-brand cursor-pointer relative"
                          >
                            {Math.floor(estMin / 60) > 0 ? `${Math.floor(estMin / 60)}h ${estMin % 60}m` : `${estMin}m`}
                            {openClockPickerId === task.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenClockPickerId(null); }} />
                                <div className="absolute left-0 top-full mt-2 bg-surface border border-edge p-3 rounded-2xl shadow-xl z-50 min-w-[220px] text-left space-y-2">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Presets</div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[15, 25, 45, 60, 90, 120].map(p => (
                                      <button
                                        key={p}
                                        onClick={(e) => { e.stopPropagation(); onUpdateTask(task.id, { estimatedMinutes: p }); }}
                                        className="text-[11px] font-bold text-ink-muted hover:text-ink bg-surface-sunken hover:bg-brand-soft/30 border border-edge-soft rounded-lg py-1 cursor-pointer"
                                      >{p >= 60 ? `${Math.floor(p / 60)}h${p % 60 ? ` ${p % 60}m` : ""}` : `${p}m`}</button>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => onUpdateTask(task.id, { estimatedMinutes: estMin + 5 })}
                            className="px-2 py-1 text-brand font-bold hover:bg-brand-soft/30 rounded-r-lg cursor-pointer"
                          >+</button>
                        </div>

                        <button
                          onClick={() => { const est = estimateTaskDuration(task.title); onUpdateTask(task.id, { estimatedMinutes: est }); }}
                          className="p-1.5 rounded-lg text-brand hover:bg-brand-soft/30 cursor-pointer"
                          title="Magic re-estimate"
                        >
                          <Sparkles size={13} />
                        </button>

                        {totalSubs === 0 && !task.completed && (
                          <button
                            id={`breakdown-btn-${task.id}`}
                            onClick={() => handleBreakItDown(task)}
                            disabled={breakingDownTaskIds[task.id]}
                            className="px-2.5 py-1.5 text-xs font-bold text-brand bg-brand-soft/30 border border-brand/30 hover:bg-brand-soft/50 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            {breakingDownTaskIds[task.id] ? (
                              <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                            ) : <Sparkles size={12} />}
                            Break down
                          </button>
                        )}

                        <button
                          id={`schedule-btn-${task.id}`}
                          onClick={() => handleOpenSchedule(task.id)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface cursor-pointer"
                          title="Schedule"
                        >
                          <Calendar size={14} />
                        </button>

                        <button
                          id={`delete-task-btn-${task.id}`}
                          onClick={() => { onDeleteTask(task.id); onGubbyMessage("Quest banished!", "cozy"); }}
                          className="ml-auto p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subtasks panel */}
                <AnimatePresence>
                  {(isExpanded || breakingDownTaskIds[task.id]) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-edge-soft bg-surface/40"
                    >
                      <div className="pl-4 pr-3 py-3 space-y-2">
                        {task.subtasks.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2.5 group">
                            <button
                              onClick={() => handleToggleSubtask(task.id, sub.id)}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${sub.completed ? "bg-success border-success text-white" : "border-edge-strong hover:border-success bg-surface"}`}
                            >
                              {sub.completed && <Check size={10} strokeWidth={3} />}
                            </button>
                            <span className={`text-xs font-semibold text-ink flex-1 ${sub.completed ? "line-through text-ink-muted" : ""}`}>{sub.title}</span>
                            <button
                              onClick={() => handleDeleteSubtask(task.id, sub.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-ink-muted hover:text-danger transition-opacity cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            id={`manual-subtask-input-${task.id}`}
                            type="text"
                            value={manualSubtaskInputs[task.id] || ""}
                            onChange={(e) => setManualSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddManualSubtask(task.id); }}
                            placeholder="+ micro-step"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-sunken border border-edge-soft text-xs font-semibold text-ink outline-none focus:border-brand"
                          />
                          <button
                            onClick={() => handleAddManualSubtask(task.id)}
                            className="p-1.5 bg-brand hover:bg-brand-hover text-primary-foreground rounded-lg cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      )}

      {/* ── SCHEDULE MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {schedulingTaskId && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              ref={scheduleDialogRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-6 rounded-2xl border border-edge max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-ink font-fredoka flex items-center gap-2">
                <Calendar size={18} className="text-brand" /> Schedule Quest
              </h3>
              <p className="text-sm text-ink-muted">
                "<strong className="text-ink">{tasks.find(t => t.id === schedulingTaskId)?.title}</strong>"
              </p>
              <div className="space-y-1">
                <label htmlFor="schedule-date-input" className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Date</label>
                <input
                  id="schedule-date-input"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand font-semibold"
                />
                {scheduleError && (
                  <div className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                    <AlertCircle size={14} /> {scheduleError}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="schedule-time-input" className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Time (optional)</label>
                <input
                  id="schedule-time-input"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand font-semibold"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  id="cancel-schedule-btn"
                  onClick={() => setSchedulingTaskId(null)}
                  className="flex-1 py-2.5 bg-surface-sunken hover:bg-surface-raised text-ink-muted font-bold rounded-xl text-sm cursor-pointer"
                >Cancel</button>
                <button
                  id="save-schedule-btn"
                  onClick={handleSaveSchedule}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-primary-foreground font-bold rounded-xl text-sm cursor-pointer"
                >Lock it in</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Quick inline helper for getting badge classes
function getBadgeClass(priority: "low" | "medium" | "high") {
  return PRIORITY_CHIP[priority];
}
