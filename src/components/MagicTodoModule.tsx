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
        onGubbyMessage(`Gubby heard "${title}" — added by voice! 🎤`, "happy");
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

      // Guard: if the task was deleted/unmounted while the request was in flight, bail out.
      if (!tasks.some(t => t.id === task.id)) return;

      // Merge or overwrite subtasks
      onUpdateTask(task.id, { subtasks: [...task.subtasks, ...newSubtasks] });

      // Auto expand to see result
      setExpandedTaskIds(prev => ({ ...prev, [task.id]: true }));
      onGubbyMessage(`Boom! Sliced into ${generatedSteps.length} micro-steps. Take a look!`, "excited");
    } catch (err: any) {
      console.error(err);
      onGubbyMessage("Gubby couldn't slice this task automatically. Let's write subtasks manually!", "cozy");
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

  const filteredTasks = tasks.filter(t => {
    if (listFilter === "date") {
      return t.scheduledDate === activeDate;
    } else if (listFilter === "someday") {
      return !t.scheduledDate;
    } else {
      return true; // "all"
    }
  }).sort((a, b) => {
    // 1. Show uncompleted tasks first, completed tasks last
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    // 2. Sort by priority: high -> medium -> low
    const weight = { high: 1, medium: 2, low: 3 };
    const valA = weight[a.priority] || 2;
    const valB = weight[b.priority] || 2;
    return valA - valB;
  });

  // Today's top 3: uncompleted, today-scheduled, sorted by priority
  const todayStr2 = toLocalDateKey();
  const top3Today = tasks
    .filter(t => !t.completed && t.scheduledDate === todayStr2)
    .sort((a, b) => { const w = { high: 0, medium: 1, low: 2 }; return w[a.priority] - w[b.priority]; })
    .slice(0, 3);

  return (
    <div id="magic-todo-module" className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">


      {/* 0. Today's Top 3 — "What should I do right now?" */}
      <AnimatePresence>
        {top3Today.length > 0 && (
          <motion.div
            key="top3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-gradient-to-br from-[#FFF5EB] to-[#FFECD8] border-2 border-brand/20 rounded-2xl p-3 sm:p-4 card-shadow"
          >
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <span className="text-base">🎯</span>
              <h3 className="font-bold text-ink font-fredoka text-sm">What to do right now?</h3>
              <span className="text-[11px] sm:text-xs text-ink-muted ml-auto">Top {top3Today.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {top3Today.map((task, i) => (
                <div key={task.id} className="flex items-center gap-2 sm:gap-3 bg-surface/70 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 border border-brand/10 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-brand/60 w-4 shrink-0">#{i + 1}</span>
                  <span className="text-[13px] sm:text-sm font-semibold text-ink flex-1 truncate min-w-0">
                    {task.priority === "high" ? "🔴" : task.priority === "medium" ? "🟡" : "🟢"} {task.title}
                  </span>
                  <button
                    onClick={() => {
                      onFocusTask(task.title, undefined, task.id);
                      if (onFocusAndSwitch) onFocusAndSwitch(task.title, task.id);
                      onGubbyMessage(`Starting "${task.title}"! You've got this 🎯`, "focused");
                    }}
                    className="shrink-0 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-9 bg-brand text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-brand-hover transition-colors cursor-pointer"
                  >
                    <Play size={11} className="fill-white" /> <span className="hidden xs:inline sm:inline">Start</span>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {top3Today.length === 0 && tasks.filter(t => !t.completed && t.scheduledDate === todayStr2).length === 0 && tasks.filter(t => !t.completed).length > 0 && (
          <motion.div key="no-today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3 text-xs text-ink-muted font-semibold">
            📅 No tasks scheduled for today — add one below or schedule from your backlog!
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Add Task Form */}
      <div className="bg-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-edge card-shadow">
        <h3 className="text-base sm:text-lg font-bold text-ink mb-3 sm:mb-4 font-fredoka flex items-center gap-2">
          What feels too big right now?
        </h3>

        <form onSubmit={handleAddTaskSubmit} className="space-y-3 sm:space-y-4">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch">
            {/* Title field */}
            <div className="flex-1 relative min-w-0">
              <input
                id="todo-title-input"
                type="text"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="E.g., clean the study, write the report..."
                className="w-full p-3 sm:p-4 pr-11 sm:pr-12 rounded-2xl bg-surface-sunken border-2 border-edge-soft focus:border-brand focus:bg-surface outline-none font-nunito text-ink-2 placeholder-stone-400 font-bold transition-all text-base"
              />
              {speech.supported && (
                <button
                  type="button"
                  id="todo-mic-btn"
                  onClick={() => (speech.listening ? speech.stop() : speech.start())}
                  title={speech.listening ? "Stop dictation" : "Dictate, or say 'add <task>'"}
                  className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-xl border-2 transition-all cursor-pointer select-none ${
                    speech.listening
                      ? "bg-brand text-white border-brand animate-pulse"
                      : "bg-surface  border-edge-soft  text-ink-muted  hover:text-brand"
                  }`}
                >
                  {speech.listening ? <Square size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>

            {/* Priority Interactive Slider */}
            <div className="bg-surface-sunken border-2 border-edge-soft p-2.5 sm:p-3 rounded-2xl flex flex-col justify-center md:min-w-[200px] gap-1">
              <label htmlFor="priority-slider" className="text-[11px] sm:text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1">
                <Plus size={12} className="text-brand" /> Priority: {priorityVal === 1 ? "🟢" : priorityVal === 2 ? "🟡" : "🔴"}
              </label>
              
              <div className="flex items-center gap-3">
                <input
                  id="priority-slider"
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={priorityVal}
                  onChange={(e) => handlePriorityChange(parseInt(e.target.value, 10))}
                  className="flex-1 accent-[#F27D26] cursor-pointer h-1.5 bg-surface-raised2 rounded-lg appearance-none"
                />
                <span className="text-xl select-none shrink-0 font-fredoka">
                  {priorityVal === 1 && "🟢"}
                  {priorityVal === 2 && "🟡"}
                  {priorityVal === 3 && "🔴"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
            {formError ? (
              <div id="todo-form-error" className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                <AlertCircle size={14} /> {formError}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="text-[11px] sm:text-xs text-ink-muted font-semibold italic">
                  ✨ Gubby will help you slice this quest down!
                </div>
                {newTitle.trim() && (
                  <div className="text-[11px] sm:text-xs font-bold text-brand flex items-center gap-1.5 flex-wrap">
                    <Sparkles size={12} className="animate-pulse text-brand shrink-0" />
                    <span>Auto Estimate: <strong className="font-mono bg-orange-50 text-orange-900 border border-orange-100 px-1.5 py-0.5 rounded-md">{estimateTaskDuration(newTitle)}m</strong></span>
                  </div>
                )}
              </div>
            )}

            <button
              id="add-todo-btn"
              type="submit"
              className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 min-h-11 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl shadow hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer select-none"
            >
              <Plus size={18} /> Add Mission
            </button>
          </div>
        </form>
      </div>



      {/* 2. Tasks Master List */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-b-2 border-edge pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-ink font-fredoka flex items-center gap-2 truncate">
                My Goblin Quests ({filteredTasks.length})
              </h2>
              <p className="text-[11px] sm:text-xs text-ink-muted font-semibold truncate">
                {listFilter === "date" && `Viewing date: ${activeDate}`}
                {listFilter === "all" && "Viewing all active quests"}
                {listFilter === "someday" && "Viewing unscheduled backlog"}
              </p>
            </div>
            
            <div className="grid grid-cols-3 sm:flex sm:items-center gap-1 sm:gap-1.5 bg-[#F5FAF5] p-1 rounded-xl border border-edge w-full sm:w-auto">
              <button
                id="filter-date-btn"
                type="button"
                onClick={() => {
                  setListFilter("date");
                  onGubbyMessage(`Focusing on quests for ${activeDate}! 📅`, "cozy");
                }}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  listFilter === "date"
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink-muted  hover:text-ink "
                }`}
              >
                Date
              </button>
              <button
                id="filter-all-btn"
                type="button"
                onClick={() => {
                  setListFilter("all");
                  onGubbyMessage("Viewing your entire quest board! 🌟", "happy");
                }}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  listFilter === "all"
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink-muted  hover:text-ink "
                }`}
              >
                All
              </button>
              <button
                id="filter-someday-btn"
                type="button"
                onClick={() => {
                  setListFilter("someday");
                  onGubbyMessage("Viewing unscheduled background ideas! 🍂", "cozy");
                }}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  listFilter === "someday"
                    ? "bg-brand text-white shadow-sm"
                    : "text-ink-muted  hover:text-ink "
                }`}
              >
                Someday
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            {listFilter === "date" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-muted">Change Date:</span>
                <input
                  id="magic-todo-date-picker"
                  type="date"
                  value={activeDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      onSelectDate(e.target.value);
                      onGubbyMessage(`Shifted active date to ${e.target.value}! 📅`, "happy");
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-edge bg-surface text-ink-2 outline-none focus:border-brand cursor-pointer"
                />
              </div>
            ) : <div />}

            {tasks.filter(t => t.completed).length > 0 && (
              <button
                id="clear-completed-todo-btn"
                onClick={() => {
                  tasks.filter(t => t.completed).forEach(t => onDeleteTask(t.id));
                  onGubbyMessage("Cleaned away your completed quests! Sparkling tidy now! ✨", "happy");
                  pushToast({ icon: "🧹", message: "Completed quests swept away", tone: "info" });
                }}
                className="text-xs text-ink-muted hover:text-red-500 font-bold transition-colors border-2 border-edge hover:border-red-100 px-3 py-1.5 rounded-xl bg-surface cursor-pointer"
              >
                Sweep Completed Quests
              </button>
            )}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          tasks.length === 0 ? (
            <div className="bg-surface border-2 border-dashed border-edge p-12 rounded-3xl text-center space-y-3">
              <p className="text-ink-muted font-bold text-lg font-fredoka">No active quests on your board!</p>
              <p className="text-ink-muted text-sm max-w-sm mx-auto">
                You are completely clean! Brainstorm some missions in the <strong>Brain Dump Compiler</strong> or type one above to start.
              </p>
            </div>
          ) : (
            <div className="bg-surface border-2 border-dashed border-edge p-10 rounded-3xl text-center space-y-4">
              <p className="text-ink-muted font-bold text-lg font-fredoka">
                {listFilter === "date" ? `No quests scheduled for ${activeDate}!` : "No quests match your filter!"}
              </p>
              <p className="text-ink-muted text-sm max-w-md mx-auto">
                {listFilter === "date"
                  ? `You have active quests in your backlog, but none are pinned to ${activeDate} yet.`
                  : "You have active quests, but none match this view mode."}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  id="quick-add-for-today"
                  onClick={() => {
                    const el = document.getElementById("todo-title-input");
                    if (el) el.focus();
                    onGubbyMessage(
                      listFilter === "date"
                        ? `Type a new quest above, and I'll auto-schedule it for ${activeDate}!`
                        : "Type a new quest above, and I'll add it for you!",
                      "excited"
                    );
                  }}
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-xs shadow transition-all cursor-pointer"
                >
                  {listFilter === "date" ? `Create Quest for ${activeDate} 🌟` : "Create New Quest 🌟"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => {
              const completedSubs = task.subtasks.filter(s => s.completed).length;
              const totalSubs = task.subtasks.length;
              const subPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
              const isExpanded = !!expandedTaskIds[task.id];

              const controlsExpanded = !!expandedControlIds[task.id];

              return (
                <div
                  key={task.id}
                  className={`bg-gradient-to-br rounded-2xl border-2 transition-all card-shadow ${
                    task.completed
                      ? "from-white to-white border-edge-soft   opacity-60"
                      : task.priority === "high"
                      ? "from-[#FFF5EB] to-white border-orange-200/70 hover:border-orange-300"
                      : task.priority === "medium"
                      ? "from-[#F9FBF9] to-white border-edge   hover:border-emerald-300"
                      : "from-[#F0F7F0] to-white border-edge   hover:border-emerald-300"
                  }`}
                >
                  {/* Task Card Header Area */}
                  <div className="p-3 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    
                    {/* Left: Checkbox + Title */}
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <button
                        id={`todo-checkbox-${task.id}`}
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={`Mark "${task.title}" as ${task.completed ? "not completed" : "completed"}`}
                        onClick={() => onToggleTask(task.id)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5 ${
                          task.completed
                            ? "bg-brand border-brand text-white"
                            : "border-brand bg-surface  hover:bg-orange-50"
                        }`}
                      >
                        {task.completed && <Check size={16} strokeWidth={3} />}
                      </button>

                      <div className="space-y-1 min-w-0 flex-1">
                        <span className={`text-sm sm:text-base font-bold text-ink block leading-snug font-fredoka break-words ${task.completed ? "line-through text-ink-muted" : ""}`}>
                          {task.title}
                        </span>

                        {/* Task size meter + scary-task shrinker */}
                        {!task.completed && (() => {
                          const size = getTaskSize(task);
                          const segments = size === "large" ? 3 : size === "medium" ? 2 : 1;
                          const segColor = size === "large" ? "bg-rose-400" : size === "medium" ? "bg-amber-400" : "bg-emerald-400";
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5" title={`This quest feels ${size}`} aria-label={`Task size: ${size}`}>
                                {[1, 2, 3].map((seg) => (
                                  <span
                                    key={seg}
                                    className={`w-4 h-1.5 rounded-full ${seg <= segments ? segColor : "bg-[#E6EEE6]"}`}
                                  />
                                ))}
                              </div>
                              {size === "large" && totalSubs === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleBreakItDown(task)}
                                  disabled={breakingDownTaskIds[task.id]}
                                  className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1"
                                  title="Shrink this scary quest into tiny steps"
                                >
                                  {breakingDownTaskIds[task.id] ? "…" : "😱 Too big — break it down"}
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Scheduled Time info if exists */}
                          {task.scheduledTime && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-soft/20 px-2.5 py-1 rounded-lg w-fit border border-[#FFD4A3]/40">
                              <Clock size={12} />
                              <span>Scheduled @ {task.scheduledTime}</span>
                            </div>
                          )}

                          {/* Automatic Estimate Timer with adjustment buttons and a beautiful clock popover (ADHD-friendly goblin.tools style) */}
                          <div className="relative flex items-center gap-1.5 bg-surface-sunken border border-edge-soft px-2.5 py-1 rounded-xl w-fit shadow-sm">
                            <Clock size={11} className="text-brand shrink-0" />
                            <span className="text-[10px] font-bold text-ink-muted">Estimate:</span>
                            
                            <div className="flex items-center gap-1 bg-surface border border-edge-soft rounded-lg px-1 py-0.5">
                              {/* Decrement Button */}
                              <button
                                id={`dec-estimate-btn-${task.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentEst = task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title);
                                  const nextEst = Math.max(5, currentEst - 5);
                                  onUpdateTask(task.id, { estimatedMinutes: nextEst });
                                  onGubbyMessage(`Decreased estimate for "${task.title}" to ${nextEst}m! ⏱️`, "cozy");
                                }}
                                className="text-xs font-extrabold text-brand hover:bg-[#FFF5EB] w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer select-none"
                                title="Decrease estimate by 5 mins"
                              >
                                -
                              </button>

                              {/* Interactive Clock Trigger button showing Hours & Minutes */}
                              <button
                                id={`clock-picker-trigger-${task.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenClockPickerId(openClockPickerId === task.id ? null : task.id);
                                }}
                                className="px-1 text-xs font-extrabold text-ink font-mono hover:text-brand transition-colors cursor-pointer select-none"
                                title="Click to open hours & minutes clock picker"
                              >
                                {(() => {
                                  const totalMins = task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title);
                                  const h = Math.floor(totalMins / 60);
                                  const m = totalMins % 60;
                                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                })()} ⏱️
                              </button>

                              {/* Increment Button */}
                              <button
                                id={`inc-estimate-btn-${task.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentEst = task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title);
                                  const nextEst = currentEst + 5;
                                  onUpdateTask(task.id, { estimatedMinutes: nextEst });
                                  onGubbyMessage(`Increased estimate for "${task.title}" to ${nextEst}m! ⏱️`, "happy");
                                }}
                                className="text-xs font-extrabold text-brand hover:bg-[#FFF5EB] w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer select-none"
                                title="Increase estimate by 5 mins"
                              >
                                +
                              </button>
                            </div>

                            {/* Magic Re-estimate button */}
                            <button
                              id={`reestimate-btn-${task.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const est = estimateTaskDuration(task.title);
                                onUpdateTask(task.id, { estimatedMinutes: est });
                                onGubbyMessage(`Gubby magic-estimated "${task.title}" at ${est}m! 🪄🦉`, "excited");
                              }}
                              className="p-1 text-brand hover:bg-surface rounded-lg border border-transparent hover:border-edge-soft transition-all cursor-pointer flex items-center justify-center"
                              title="Recalculate Magic Estimate"
                            >
                              <Sparkles size={11} className="animate-pulse text-brand" />
                            </button>

                            {/* Clock Hours & Minutes Selection Popover */}
                            {openClockPickerId === task.id && (
                              <>
                                {/* Click outside overlay to close picker */}
                                <div 
                                  className="fixed inset-0 z-40 cursor-default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenClockPickerId(null);
                                  }}
                                />
                                <div className="absolute left-0 top-full mt-2 bg-surface border-2 border-edge p-3.5 rounded-2xl shadow-xl z-50 min-w-[240px] text-left space-y-3">
                                  <div className="flex items-center justify-between border-b border-edge pb-1.5">
                                    <span className="text-xs font-extrabold text-ink font-fredoka flex items-center gap-1.5">
                                      ⏰ Custom Quest Timer
                                    </span>
                                    <span className="text-[9px] font-bold text-brand bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">
                                      {task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title)}m total
                                    </span>
                                  </div>

                                  {/* Custom Clock Hours & Minutes Dropdown Controls */}
                                  <div className="grid grid-cols-2 gap-2.5">
                                    {/* Hours dropdown */}
                                    <div className="flex flex-col gap-1">
                                      <label htmlFor={`hours-select-${task.id}`} className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Hours</label>
                                      <select
                                        id={`hours-select-${task.id}`}
                                        value={Math.floor((task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title)) / 60)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentMinutes = task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title);
                                          const currentMins = currentMinutes % 60;
                                          const nextHours = parseInt(e.target.value, 10);
                                          const total = nextHours * 60 + currentMins;
                                          onUpdateTask(task.id, { estimatedMinutes: total });
                                          onGubbyMessage(`Set hours to ${nextHours}h! total: ${total}m. 🦉`, "happy");
                                        }}
                                        className="w-full bg-surface border border-edge rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-ink font-mono focus:outline-none focus:border-brand"
                                      >
                                        {Array.from({ length: 24 }).map((_, i) => (
                                          <option key={i} value={i}>{i}h</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Minutes dropdown */}
                                    <div className="flex flex-col gap-1">
                                      <label htmlFor={`minutes-select-${task.id}`} className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Minutes</label>
                                      <select
                                        id={`minutes-select-${task.id}`}
                                        value={(task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title)) % 60}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentMinutes = task.estimatedMinutes !== undefined ? task.estimatedMinutes : estimateTaskDuration(task.title);
                                          const currentHours = Math.floor(currentMinutes / 60);
                                          const nextMins = parseInt(e.target.value, 10);
                                          const total = currentHours * 60 + nextMins;
                                          onUpdateTask(task.id, { estimatedMinutes: total });
                                          onGubbyMessage(`Set minutes to ${nextMins}m! total: ${total}m. 🦉`, "happy");
                                        }}
                                        className="w-full bg-surface border border-edge rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-ink font-mono focus:outline-none focus:border-brand"
                                      >
                                        {Array.from({ length: 60 }).map((_, i) => (
                                          <option key={i} value={i}>{i < 10 ? `0${i}` : i}m</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Presets Grid */}
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-ink-muted uppercase tracking-widest block">Presets</span>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {[15, 25, 45, 60, 90, 120].map((preset) => (
                                        <button
                                          key={preset}
                                          id={`preset-btn-${task.id}-${preset}`}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateTask(task.id, { estimatedMinutes: preset });
                                            onGubbyMessage(`Instant set task estimate to ${preset} minutes! Let's conquer it!`, "happy");
                                          }}
                                          className="text-[10px] font-bold text-ink-muted hover:text-ink bg-surface-sunken border border-edge-soft hover:bg-brand-soft/20 hover:border-brand/20 px-1 py-1 rounded-lg transition-colors cursor-pointer"
                                        >
                                          {preset >= 60 ? `${Math.floor(preset / 60)}h${preset % 60 > 0 ? ` ${preset % 60}m` : ""}` : `${preset}m`}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-1 border-t border-stone-50">
                                    <button
                                      id={`clock-picker-ok-${task.id}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenClockPickerId(null);
                                      }}
                                      className="w-full py-1.5 bg-brand hover:bg-brand-hover text-white font-bold text-[10px] rounded-xl transition-all cursor-pointer text-center"
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action buttons — minimal by default, expanded on toggle */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center pl-10 sm:pl-11 md:pl-0">

                      {/* Always-visible: Focus button */}
                      {!task.completed && !controlsExpanded && (
                        <button
                          id={`focus-btn-quick-${task.id}`}
                          onClick={() => {
                            onFocusTask(task.title, undefined, task.id);
                            if (onFocusAndSwitch) onFocusAndSwitch(task.title, task.id);
                            onGubbyMessage(`Loading "${task.title}" into Focus Timer!`, "focused");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          <Play size={11} className="fill-white" /> Focus
                        </button>
                      )}

                      {/* Expand/collapse controls toggle */}
                      <button
                        id={`expand-controls-${task.id}`}
                        onClick={() => toggleControls(task.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-ink-muted hover:text-ink hover:bg-surface-raised rounded-xl text-xs font-bold transition-all cursor-pointer border border-edge-soft"
                        title={controlsExpanded ? "Hide controls" : "More options"}
                      >
                        {controlsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span className="text-[10px]">{controlsExpanded ? "Less" : "···"}</span>
                      </button>

                      {/* Full controls — visible only when expanded */}
                      <AnimatePresence>
                        {controlsExpanded && (
                          <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="flex flex-wrap items-center gap-2 overflow-visible"
                          >
                      {/* Interactive Priority icon button with tooltip & select menu */}
                      <div className="relative group/tooltip">
                        <button
                          id={`priority-btn-${task.id}`}
                          type="button"
                          aria-label={`Change priority for "${task.title}" (currently ${task.priority})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPriorityMenuId(openPriorityMenuId === task.id ? null : task.id);
                          }}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer select-none shadow-sm ${getBadgeClass(task.priority)}`}
                        >
                          {getPriorityLabel(task.priority)}
                        </button>

                        {/* Tooltip on Hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-md">
                          <span className="capitalize">{task.priority} Priority</span> - Click to change
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                        </div>

                        {/* Dropdown Menu for Priority Selection */}
                        {openPriorityMenuId === task.id && (
                          <>
                            {/* Overlay to detect click outside */}
                            <div 
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenPriorityMenuId(null);
                              }}
                            />
                            <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-surface border-2 border-edge p-1.5 rounded-2xl shadow-xl z-50 flex flex-col gap-1 min-w-[130px]">
                              {(["low", "medium", "high"] as const).map((lvl) => (
                                <button
                                  key={lvl}
                                  id={`priority-opt-${task.id}-${lvl}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateTask(task.id, { priority: lvl });
                                    setOpenPriorityMenuId(null);
                                    onGubbyMessage(`Adjusted priority of "${task.title}" to ${lvl}! 🎯`, "happy");
                                  }}
                                  className={`flex items-center gap-2.5 px-3 py-1.5 text-xs font-bold rounded-xl text-left transition-colors cursor-pointer w-full hover:bg-surface  ${
                                    task.priority === lvl ? "bg-surface-raised  text-ink " : "text-stone-600"
                                  }`}
                                >
                                  <span>{getPriorityLabel(lvl)}</span>
                                  <span className="capitalize">{lvl}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Break it down button */}
                      {totalSubs === 0 && !task.completed && (
                        <div className="relative group/tooltip">
                          <button
                            id={`breakdown-btn-${task.id}`}
                            aria-label={`Break "${task.title}" down into subtasks`}
                            onClick={() => handleBreakItDown(task)}
                            disabled={breakingDownTaskIds[task.id]}
                            className="w-9 h-9 rounded-full bg-brand-soft text-brand border border-brand/30 hover:bg-brand-soft/80 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer select-none disabled:bg-surface-disabled shadow-sm"
                          >
                            {breakingDownTaskIds[task.id] ? (
                              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Sparkles size={14} />
                            )}
                          </button>

                          {/* Tooltip on Hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-md">
                            {breakingDownTaskIds[task.id] ? "Slicing tasks..." : "Break down into subtasks 🪄"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                          </div>
                        </div>
                      )}

                      {/* Focus Button */}
                      {!task.completed && (
                        <div className="relative group/tooltip">
                          <button
                            id={`focus-btn-${task.id}`}
                            aria-label={`Start focus session for "${task.title}"`}
                            onClick={() => onFocusTask(task.title, undefined, task.id)}
                            className="w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer select-none shadow-sm"
                          >
                            <Play size={14} className="fill-current ml-0.5" />
                          </button>

                          {/* Tooltip on Hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-md">
                            Focus Session 🎯
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                          </div>
                        </div>
                      )}



                      {/* Schedule pop-up triggers */}
                      <div className="relative group/tooltip">
                        <button
                          id={`schedule-btn-${task.id}`}
                          aria-label={`Schedule "${task.title}" on calendar`}
                          onClick={() => handleOpenSchedule(task.id)}
                          className="w-9 h-9 rounded-full border-2 border-edge bg-surface text-ink-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer select-none shadow-sm"
                        >
                          <Calendar size={14} />
                        </button>

                        {/* Tooltip on Hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-stone-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-md">
                          Schedule on Calendar 📅
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></div>
                        </div>
                      </div>

                      {/* Toggle Subtasks view / Add micro-step — always reachable, even for 0-subtask tasks.
                          Without this, fresh tasks had no way to open the panel and add subtasks manually. */}
                      <button
                        id={`toggle-subtasks-btn-${task.id}`}
                        onClick={() => handleToggleExpand(task.id)}
                        className="px-2.5 py-1.5 border-2 border-edge text-ink-muted rounded-xl hover:bg-surface font-bold text-xs flex items-center gap-1.5"
                        title={totalSubs > 0 ? "Show / hide micro-steps" : "Add micro-steps to break this quest down"}
                      >
                        {totalSubs === 0 ? (
                          isExpanded ? (
                            <><ChevronUp size={12} /> Hide</>
                          ) : (
                            <><Plus size={12} /> Add steps</>
                          )
                        ) : (
                          <>
                            <div className="flex gap-0.5 mr-1">
                              {Array.from({ length: Math.min(totalSubs, 8) }).map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < completedSubs ? "bg-[#556B55]" : "bg-surface "}`} />
                              ))}
                              {totalSubs > 8 && <span className="text-[8px] leading-[6px] ml-0.5 opacity-50 text-ink-muted">+{totalSubs - 8}</span>}
                            </div>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        id={`delete-task-btn-${task.id}`}
                        aria-label={`Delete quest "${task.title}"`}
                        onClick={() => {
                          onDeleteTask(task.id);
                          onGubbyMessage("Goblin quest banished! Begone, task clutter!", "cozy");
                        }}
                        className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all"
                        title="Delete quest completely"
                      >
                        <Trash2 size={14} />
                      </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>

                  {/* Nested Subtask Content Panel */}
                  <AnimatePresence>
                    {(isExpanded || breakingDownTaskIds[task.id]) && (
                      <motion.div
                        key={task.id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t-2 border-edge bg-surface rounded-b-2xl"
                      >
                        <div className="p-3 sm:p-4 pl-3 sm:pl-12 space-y-3 sm:space-y-4">
                          
                          {/* Subtask Progress bar */}
                          {totalSubs > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-ink-muted font-bold">
                                <span>Quest Progress: {subPercent}%</span>
                                <span className="flex gap-1 mt-0.5">
                                  {Array.from({ length: Math.min(totalSubs, 12) }).map((_, i) => (
                                    <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < completedSubs ? "bg-brand" : "bg-brand-soft/40"}`} />
                                  ))}
                                  {totalSubs > 12 && <span className="text-[10px] ml-1 opacity-70">+{totalSubs - 12}</span>}
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-surface-sunken rounded-full overflow-hidden border-2 border-edge-soft">
                                <div
                                  className="h-full bg-brand rounded-full transition-all duration-300"
                                  style={{ width: `${subPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Individual subtask checklist */}
                          <div className="space-y-2.5">
                            {task.subtasks.map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between gap-3 bg-surface-sunken p-2.5 rounded-xl border border-edge-soft"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <button
                                    id={`subtask-checkbox-${sub.id}`}
                                    role="checkbox"
                                    aria-checked={sub.completed}
                                    aria-label={`Mark "${sub.title}" as ${sub.completed ? "not completed" : "completed"}`}
                                    onClick={() => handleToggleSubtask(task.id, sub.id)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                      sub.completed
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : "border-edge-strong  bg-surface  hover:border-emerald-600"
                                    }`}
                                  >
                                    {sub.completed && <Check size={12} strokeWidth={3} />}
                                  </button>
                                  <span className={`text-sm font-semibold text-ink-2  leading-snug ${sub.completed ? "line-through text-ink-muted" : ""}`}>
                                    {sub.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">

                                  
                                  {/* Delete subtask */}
                                  <button
                                    id={`delete-subtask-btn-${sub.id}`}
                                    aria-label={`Delete micro-step "${sub.title}"`}
                                    onClick={() => handleDeleteSubtask(task.id, sub.id)}
                                    className="p-1 text-ink-muted hover:text-red-500 rounded-lg"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Quick manual subtask input */}
                          <div className="flex items-center gap-2 pt-2 border-t border-edge-soft">
                            <input
                              id={`manual-subtask-input-${task.id}`}
                              type="text"
                              value={manualSubtaskInputs[task.id] || ""}
                              onChange={(e) => setManualSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddManualSubtask(task.id);
                              }}
                              placeholder="Add another micro-step..."
                              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-sunken border-2 border-edge-soft text-xs font-semibold text-ink-2 outline-none focus:border-brand"
                            />
                            <button
                              id={`add-manual-subtask-btn-${task.id}`}
                              onClick={() => handleAddManualSubtask(task.id)}
                              className="p-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Scheduling Popup Modal */}
      <AnimatePresence>
        {schedulingTaskId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              ref={scheduleDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Schedule your quest"
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-edge max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-xl font-bold text-ink font-fredoka flex items-center gap-2">
                <Calendar size={22} className="text-brand" /> Schedule Your Quest
              </h3>
              
              <div className="space-y-3 font-nunito">
                <p className="text-sm font-semibold text-ink-2">
                  Target Mission: <strong className="text-ink">"{tasks.find(t => t.id === schedulingTaskId)?.title}"</strong>
                </p>

                <div className="space-y-1">
                  <label htmlFor="schedule-date-input" className="text-xs font-bold text-ink-muted uppercase">Select Date:</label>
                  <input
                    id="schedule-date-input"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                  />
                  {scheduleError && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                      <AlertCircle size={14} /> {scheduleError}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="schedule-time-input" className="text-xs font-bold text-ink-muted uppercase">Select Time (Optional):</label>
                  <input
                    id="schedule-time-input"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  id="cancel-schedule-btn"
                  onClick={() => setSchedulingTaskId(null)}
                  className="flex-1 py-2.5 bg-surface-raised hover:bg-surface-raised2 text-ink-muted font-bold rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  id="save-schedule-btn"
                  onClick={handleSaveSchedule}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-colors text-sm"
                >
                  Lock It In!
                </button>
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
