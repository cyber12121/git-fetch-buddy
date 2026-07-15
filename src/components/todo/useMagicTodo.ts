import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, SubTask } from "../../types";
import { estimateTaskDuration, toLocalDateKey } from "../../lib/constants";
import { breakdownTask } from "../../lib/goblin-api.functions";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface Options {
  tasks: Task[];
  onAddTask: (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string, estimatedMinutes?: number) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  onGainXp?: (amount: number) => void;
  selectedDate: string;
}

/**
 * Owns all interactive state and mutation handlers for MagicTodoModule.
 * Keeps the module component focused on layout while this hook manages:
 * filter, composer, expansion, breakdown API, subtasks, and scheduling.
 */
export function useMagicTodo({
  tasks, onAddTask, onUpdateTask, onGubbyMessage, onGainXp, selectedDate,
}: Options) {
  const todayStr = toLocalDateKey();
  const activeDate = selectedDate || todayStr;

  // List filter
  const [listFilter, setListFilter] = useState<"date" | "all" | "someday">("date");

  // Composer
  const [newTitle, setNewTitle] = useState("");
  const [priorityVal, setPriorityVal] = useState<number>(2); // 1=low, 2=med, 3=high
  const [formError, setFormError] = useState<string | null>(null);

  // Row expansion
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [expandedControlIds, setExpandedControlIds] = useState<Record<string, boolean>>({});
  const toggleControls = useCallback((id: string) => {
    setExpandedControlIds(p => ({ ...p, [id]: !p[id] }));
  }, []);
  const toggleExpand = useCallback((id: string) => {
    setExpandedTaskIds(p => ({ ...p, [id]: !p[id] }));
  }, []);

  // Scheduler
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Breakdown loading / popovers / manual sub inputs
  const [breakingDownTaskIds, setBreakingDownTaskIds] = useState<Record<string, boolean>>({});
  const [openPriorityMenuId, setOpenPriorityMenuId] = useState<string | null>(null);
  const [openClockPickerId, setOpenClockPickerId] = useState<string | null>(null);
  const [manualSubtaskInputs, setManualSubtaskInputs] = useState<Record<string, string>>({});

  // Keep latest tasks reachable inside async handlers so post-await guards
  // see current data rather than a stale render snapshot.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const handlePriorityChange = useCallback((val: number) => {
    setPriorityVal(val);
    if (val === 1) onGubbyMessage("Low pressure! Easy start, we can get this done in a snap!", "happy");
    else if (val === 2) onGubbyMessage("Medium effort! Requires a bit of focus juice.", "thoughtful");
    else onGubbyMessage("High priority! 🎯 This is a key item. Breaking it down is highly recommended!", "excited");
  }, [onGubbyMessage]);

  const submitNewTask = useCallback(() => {
    if (!newTitle.trim()) {
      setFormError("What is your mission? Please write a name first!");
      return;
    }
    const priorityMap: Record<number, "low" | "medium" | "high"> = { 1: "low", 2: "medium", 3: "high" };
    const targetDate = listFilter === "date" ? activeDate : (listFilter === "someday" ? undefined : todayStr);
    const calc = estimateTaskDuration(newTitle.trim());
    onAddTask(newTitle.trim(), priorityMap[priorityVal], undefined, targetDate, calc);

    if (targetDate) {
      onGubbyMessage(`Added: "${newTitle.trim()}" for ${targetDate}! Magic Estimate: ${calc}m. Let's handle it step-by-step!`, "happy");
    } else {
      onGubbyMessage(`Added: "${newTitle.trim()}" to your Someday ideas backlog!`, "happy");
    }
    setNewTitle("");
    setPriorityVal(2);
    setFormError(null);
  }, [newTitle, listFilter, activeDate, todayStr, priorityVal, onAddTask, onGubbyMessage]);

  // Voice-add: "add X" creates directly, otherwise appends to composer.
  const handleVoiceResult = useCallback((text: string) => {
    const lower = text.toLowerCase();
    if (lower.startsWith("add ") || lower.startsWith("new ")) {
      const title = text.slice(text.indexOf(" ") + 1).trim();
      if (title) {
        const pr = priorityVal === 1 ? "low" : priorityVal === 3 ? "high" : "medium";
        onAddTask(title, pr, undefined, activeDate, estimateTaskDuration(title));
        onGubbyMessage(`Sprig heard "${title}" — added by voice! 🎤`, "happy");
      }
    } else {
      setNewTitle(prev => (prev ? `${prev} ${text}` : text));
    }
  }, [priorityVal, activeDate, onAddTask, onGubbyMessage]);

  const handleBreakItDown = useCallback(async (task: Task) => {
    setBreakingDownTaskIds(p => ({ ...p, [task.id]: true }));
    onGubbyMessage(`Slicing "${task.title}" into micro-movements so it's less scary!`, "focused");
    try {
      const data = await breakdownTask({ data: { title: task.title, priority: task.priority } });
      const steps: string[] = data.steps || [];
      const newSubs: SubTask[] = steps.map((step, idx) => ({
        id: `sub-${Date.now()}-${idx}`, title: step, completed: false,
      }));
      const currentTask = tasksRef.current.find(t => t.id === task.id);
      if (!currentTask) return;
      onUpdateTask(task.id, { subtasks: [...currentTask.subtasks, ...newSubs] });
      setExpandedTaskIds(p => ({ ...p, [task.id]: true }));
      onGubbyMessage(`Boom! Sliced into ${steps.length} micro-steps. Take a look!`, "excited");
    } catch (err: unknown) {
      console.error(err);
      onGubbyMessage("Sprig couldn't slice this task automatically. Let's write subtasks manually!", "cozy");
    } finally {
      setBreakingDownTaskIds(p => ({ ...p, [task.id]: false }));
    }
  }, [onUpdateTask, onGubbyMessage]);

  const handleAddManualSubtask = useCallback((taskId: string) => {
    const text = manualSubtaskInputs[taskId] || "";
    if (!text.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newSub: SubTask = { id: `sub-manual-${Date.now()}`, title: text.trim(), completed: false };
    onUpdateTask(taskId, { subtasks: [...task.subtasks, newSub] });
    setManualSubtaskInputs(p => ({ ...p, [taskId]: "" }));
    setExpandedTaskIds(p => ({ ...p, [taskId]: true }));
  }, [manualSubtaskInputs, tasks, onUpdateTask]);

  const handleToggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = task.subtasks.map(sub =>
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );
    onUpdateTask(taskId, { subtasks: updated });
    const newlyCompleted = updated.find(s => s.id === subtaskId)?.completed;
    if (newlyCompleted) {
      onGubbyMessage("Yay! Micro-step completed! You are rolling!", "happy");
      onGainXp?.(3);
    } else {
      onGainXp?.(-3);
    }
  }, [tasks, onUpdateTask, onGubbyMessage, onGainXp]);

  const handleDeleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    onUpdateTask(taskId, { subtasks: task.subtasks.filter(s => s.id !== subtaskId) });
  }, [tasks, onUpdateTask]);

  const handleOpenSchedule = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setSchedulingTaskId(taskId);
    setScheduleDate(task.scheduledDate || "");
    setScheduleTime(task.scheduledTime || "");
    setScheduleError(null);
  }, [tasks]);

  const handleSaveSchedule = useCallback(() => {
    if (!schedulingTaskId) return;
    if (!scheduleDate) { setScheduleError("Please select a date!"); return; }
    onUpdateTask(schedulingTaskId, {
      scheduledDate: scheduleDate,
      scheduledTime: scheduleTime || undefined,
    });
    onGubbyMessage("Task scheduled on your calendar successfully! 📅", "happy");
    setSchedulingTaskId(null);
  }, [schedulingTaskId, scheduleDate, scheduleTime, onUpdateTask, onGubbyMessage]);

  const closeSchedule = useCallback(() => setSchedulingTaskId(null), []);

  // Memoized so keystrokes in unrelated inputs don't re-run an O(N log N)
  // filter+sort over the full task list on every render.
  const filteredTasks = useMemo(() => {
    const w: Record<Task["priority"], number> = { high: 1, medium: 2, low: 3 };
    return tasks
      .filter(t => {
        if (listFilter === "date") return t.scheduledDate === activeDate;
        if (listFilter === "someday") return !t.scheduledDate;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (w[a.priority] ?? 2) - (w[b.priority] ?? 2);
      });
  }, [tasks, listFilter, activeDate]);

  const top3Today = useMemo(() => {
    const w: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };
    return tasks
      .filter(t => !t.completed && t.scheduledDate === todayStr)
      .sort((a, b) => w[a.priority] - w[b.priority])
      .slice(0, 3);
  }, [tasks, todayStr]);

  const totalActive = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);
  const doneToday = useMemo(
    () => tasks.filter(t => t.completed && t.scheduledDate === todayStr).length,
    [tasks, todayStr],
  );
  const todayTotal = useMemo(
    () => tasks.filter(t => t.scheduledDate === todayStr).length,
    [tasks, todayStr],
  );
  const todayPct = todayTotal > 0 ? Math.round((doneToday / todayTotal) * 100) : 0;

  return {
    // dates
    todayStr, activeDate,
    // filter
    listFilter, setListFilter,
    // composer
    newTitle, setNewTitle,
    priorityVal, handlePriorityChange,
    formError, setFormError,
    submitNewTask, handleVoiceResult,
    // rows
    expandedTaskIds, expandedControlIds,
    toggleExpand, toggleControls,
    // menus
    openPriorityMenuId, setOpenPriorityMenuId,
    openClockPickerId, setOpenClockPickerId,
    // subtasks
    manualSubtaskInputs, setManualSubtaskInputs,
    handleAddManualSubtask, handleToggleSubtask, handleDeleteSubtask,
    // breakdown
    breakingDownTaskIds, handleBreakItDown,
    // schedule
    schedulingTaskId, scheduleDate, setScheduleDate,
    scheduleTime, setScheduleTime,
    scheduleError, handleOpenSchedule, handleSaveSchedule, closeSchedule,
    // derived
    filteredTasks, top3Today, totalActive, doneToday, todayTotal, todayPct,
  };
}

export type MagicTodoState = ReturnType<typeof useMagicTodo>;
