import { useCallback } from "react";
import type { Task, CalendarEvent, Habit, HabitLog, HabitDayStatus } from "../types";
import { estimateTaskDuration } from "../lib/constants";
import { recordReward, removeRewardByMessage } from "../lib/rewardHistory";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "../lib/googleCalendar";
import confetti from "canvas-confetti";
import { logCompletion, unlogCompletion } from "../lib/completionLog";
import { CONFETTI_COLORS } from "../lib/xpMilestones";
import type { GubbyMood } from "./useGubbyState";

interface Options {
  tasks: Task[];
  syncTasks: (t: Task[]) => void;
  manualEvents: CalendarEvent[];
  syncEvents: (e: CalendarEvent[]) => void;
  habits: Habit[];
  syncHabits: (h: Habit[]) => void;
  habitLog: HabitLog;
  syncHabitLog: (l: HabitLog) => void;

  accessToken: string | null;
  setIsLoadingGoogle: (b: boolean) => void;
  loadGoogleEvents: (token: string) => void;

  addXp: (n: number) => void;
  registerCombo: () => number;
  pushToast: (t: { icon?: string; tone?: "success" | "warn" | "info"; message: string }) => void;
  setGubbyMood: (m: GubbyMood) => void;
  setGubbyMessage: (m: string) => void;

  setActiveTab: (tab: "compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits") => void;
  setActiveTaskTitle: (v: string | null) => void;
  setActiveTaskId: (v: string | null) => void;
  setActiveSubtaskId: (v: string | null) => void;
}

/**
 * Groups every task / event / habit mutation into one hook so App.tsx
 * stays declarative. All handlers are stable via useCallback so memoized
 * consumers (module wrappers) don't re-render unless their own props change.
 */
export function useTaskHandlers(o: Options) {
  const {
    tasks, syncTasks, manualEvents, syncEvents,
    habits, syncHabits, habitLog, syncHabitLog,
    accessToken, setIsLoadingGoogle, loadGoogleEvents,
    addXp, registerCombo, pushToast, setGubbyMood, setGubbyMessage,
    setActiveTab, setActiveTaskTitle, setActiveTaskId, setActiveSubtaskId,
  } = o;

  // ── Habits ─────────────────────────────────────────────────────────────
  const handleAddHabit = useCallback((name: string, color: string) => {
    const newHabit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    syncHabits([...habits, newHabit]);
  }, [habits, syncHabits]);

  const handleDeleteHabit = useCallback((id: string) => {
    syncHabits(habits.filter((h) => h.id !== id));
    // Also drop any log entries keyed by this habit id.
    const updatedLog = { ...habitLog };
    for (const key of Object.keys(updatedLog)) {
      if (key.startsWith(`${id}:`)) delete updatedLog[key];
    }
    syncHabitLog(updatedLog);
  }, [habits, habitLog, syncHabits, syncHabitLog]);

  const handleToggleHabitDay = useCallback((habitId: string, date: string) => {
    const key = `${habitId}:${date}`;
    const current: HabitDayStatus = habitLog[key] || "none";
    const cycle: Record<HabitDayStatus, HabitDayStatus> = { none: "done", done: "skip", skip: "none" };
    const next = cycle[current];
    const updatedLog = { ...habitLog };
    if (next === "none") delete updatedLog[key];
    else updatedLog[key] = next;
    syncHabitLog(updatedLog);
    if (next === "done") addXp(5);
    else if (current === "done") addXp(-5);
  }, [habitLog, syncHabitLog, addXp]);

  // ── Tasks ──────────────────────────────────────────────────────────────
  const handleAddTask = useCallback(async (
    title: string,
    priority: "low" | "medium" | "high",
    notes?: string,
    scheduledDate?: string,
    estimatedMinutes?: number
  ) => {
    let googleEventId: string | undefined;

    if (scheduledDate && accessToken) {
      setIsLoadingGoogle(true);
      try {
        const gEvent = await createGoogleCalendarEvent(accessToken, `🎯 Quest: ${title}`, scheduledDate);
        if (gEvent?.id) {
          googleEventId = gEvent.id;
          loadGoogleEvents(accessToken);
        }
      } catch (err) {
        console.error("Failed to sync scheduled task to Google Calendar", err);
      } finally {
        setIsLoadingGoogle(false);
      }
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      priority,
      notes,
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
      scheduledDate,
      googleEventId,
      estimatedMinutes: estimatedMinutes ?? estimateTaskDuration(title),
    };
    syncTasks([...tasks, newTask]);
  }, [tasks, syncTasks, accessToken, setIsLoadingGoogle, loadGoogleEvents]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (taskToDelete?.googleEventId && accessToken) {
      setIsLoadingGoogle(true);
      try {
        await deleteGoogleCalendarEvent(accessToken, taskToDelete.googleEventId);
        loadGoogleEvents(accessToken);
      } catch (err) {
        console.error("Failed to delete linked Google Calendar event", err);
      } finally {
        setIsLoadingGoogle(false);
      }
    }
    syncTasks(tasks.filter((t) => t.id !== id));
  }, [tasks, syncTasks, accessToken, setIsLoadingGoogle, loadGoogleEvents]);

  const handleToggleTask = useCallback((id: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== id) return t;
      const nextCompleted = !t.completed;
      if (nextCompleted) {
        addXp(15);
        registerCombo();
        setGubbyMood("happy");
        setGubbyMessage(`Hurray! Quest "${t.title}" is finished! Gold leaf for you! 🍃✨`);
        pushToast({ icon: "✅", message: "Quest done! +15 XP", tone: "success" });
        recordReward("achievement", "✅", `Quest done: ${t.title}`);
        logCompletion({ id: t.id, title: t.title, source: "task" });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: [...CONFETTI_COLORS],
        });
      } else {
        addXp(-15);
        unlogCompletion(t.id);
      }
      return { ...t, completed: nextCompleted };
    });
    syncTasks(updated);
  }, [tasks, syncTasks, addXp, registerCombo, pushToast, setGubbyMood, setGubbyMessage]);

  const handleUpdateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const taskToUpdate = tasks.find((t) => t.id === id);
    if (!taskToUpdate) return;

    let updatedGoogleEventId = taskToUpdate.googleEventId;

    if (accessToken) {
      const titleChanged = updates.title !== undefined && updates.title !== taskToUpdate.title;
      // A date "change" means the caller explicitly set the field — either to
      // a new date or to a falsy value (undefined/empty) meaning "clear it".
      const dateProvided = Object.prototype.hasOwnProperty.call(updates, "scheduledDate");
      const dateChanged = dateProvided && updates.scheduledDate !== taskToUpdate.scheduledDate;
      // FIX: original checked `updates.scheduledDate === undefined && dateChanged` — a
      // contradiction that made "clear the date" never trigger a Google delete.
      const dateCleared = dateProvided && !updates.scheduledDate;

      if (taskToUpdate.googleEventId) {
        if (dateCleared) {
          setIsLoadingGoogle(true);
          try {
            await deleteGoogleCalendarEvent(accessToken, taskToUpdate.googleEventId);
            updatedGoogleEventId = undefined;
            loadGoogleEvents(accessToken);
          } catch (err) {
            console.error("Failed to delete Google event on date removal", err);
          } finally {
            setIsLoadingGoogle(false);
          }
        } else if (titleChanged || dateChanged) {
          setIsLoadingGoogle(true);
          try {
            await deleteGoogleCalendarEvent(accessToken, taskToUpdate.googleEventId);
            const newTitle = updates.title || taskToUpdate.title;
            const newDate = updates.scheduledDate || taskToUpdate.scheduledDate;
            if (newDate) {
              const gEvent = await createGoogleCalendarEvent(accessToken, `🎯 Quest: ${newTitle}`, newDate);
              updatedGoogleEventId = gEvent?.id || undefined;
            } else {
              updatedGoogleEventId = undefined;
            }
            loadGoogleEvents(accessToken);
          } catch (err) {
            console.error("Failed to update Google event", err);
          } finally {
            setIsLoadingGoogle(false);
          }
        }
      } else {
        // Task had no linked Google event yet — create one if a date was added.
        const targetDate = updates.scheduledDate || taskToUpdate.scheduledDate;
        if (targetDate && dateChanged) {
          setIsLoadingGoogle(true);
          try {
            const targetTitle = updates.title || taskToUpdate.title;
            const gEvent = await createGoogleCalendarEvent(accessToken, `🎯 Quest: ${targetTitle}`, targetDate);
            updatedGoogleEventId = gEvent?.id || undefined;
            loadGoogleEvents(accessToken);
          } catch (err) {
            console.error("Failed to create Google event for rescheduled task", err);
          } finally {
            setIsLoadingGoogle(false);
          }
        }
      }
    }

    const updated = tasks.map((t) =>
      t.id === id ? { ...t, ...updates, googleEventId: updatedGoogleEventId } : t
    );
    syncTasks(updated);
  }, [tasks, syncTasks, accessToken, setIsLoadingGoogle, loadGoogleEvents]);

  const handleTasksCompiled = useCallback((newCompiled: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">[]) => {
    const formatted: Task[] = newCompiled.map((t, idx) => ({
      id: `task-compiled-${Date.now()}-${idx}`,
      title: t.title,
      priority: t.priority,
      notes: t.notes || "Compiled from brain dump. Go time!",
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
      estimatedMinutes: estimateTaskDuration(t.title),
    }));
    syncTasks([...formatted, ...tasks]);
    setActiveTab("todo");
  }, [tasks, syncTasks, setActiveTab]);

  const handleFocusTask = useCallback((
    taskTitle: string,
    subtaskTitle?: string,
    taskId?: string,
    subtaskId?: string
  ) => {
    const focusTitle = subtaskTitle ? `${taskTitle} ➔ ${subtaskTitle}` : taskTitle;
    setActiveTaskTitle(focusTitle);
    setActiveTaskId(taskId ?? null);
    setActiveSubtaskId(subtaskId ?? null);
    setActiveTab("taskmaster");
  }, [setActiveTab, setActiveTaskTitle, setActiveTaskId, setActiveSubtaskId]);

  const handleCompleteActiveTask = useCallback((taskId: string, subtaskId?: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (subtaskId) {
        const sub = t.subtasks.find((s) => s.id === subtaskId);
        if (sub && !sub.completed) {
          addXp(3);
          logCompletion({ id: `${t.id}:${sub.id}`, title: `${t.title} ➔ ${sub.title}`, source: "focus" });
        }
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: true } : s
          ),
        };
      }
      if (!t.completed) {
        addXp(15);
        registerCombo();
        logCompletion({ id: t.id, title: t.title, source: "focus" });
      }
      return { ...t, completed: true };
    });
    syncTasks(updated);
    // Clear focus pointer once its quest is done — Taskmaster keys its timer
    // reload off activeTaskTitle changes so this is required for a fresh
    // "Focus" click on the same (now-completed) task to work again.
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    setActiveSubtaskId(null);
  }, [tasks, syncTasks, addXp, registerCombo, setActiveTaskId, setActiveTaskTitle, setActiveSubtaskId]);

  const handleAddManualEvent = useCallback((eventData: Omit<CalendarEvent, "id">) => {
    const newEvent: CalendarEvent = { id: `event-manual-${Date.now()}`, ...eventData };
    syncEvents([...manualEvents, newEvent]);
  }, [manualEvents, syncEvents]);

  const handleDeleteManualEvent = useCallback(async (id: string) => {
    const eventToDelete = manualEvents.find((evt) => evt.id === id);
    if (eventToDelete?.googleEventId && accessToken) {
      setIsLoadingGoogle(true);
      try {
        await deleteGoogleCalendarEvent(accessToken, eventToDelete.googleEventId);
        loadGoogleEvents(accessToken);
      } catch (err) {
        console.error("Failed to delete linked Google event during manual delete sync:", err);
      } finally {
        setIsLoadingGoogle(false);
      }
    }
    syncEvents(manualEvents.filter((evt) => evt.id !== id));
  }, [manualEvents, syncEvents, accessToken, setIsLoadingGoogle, loadGoogleEvents]);

  return {
    handleAddHabit, handleDeleteHabit, handleToggleHabitDay,
    handleAddTask, handleDeleteTask, handleToggleTask, handleUpdateTask,
    handleTasksCompiled, handleFocusTask, handleCompleteActiveTask,
    handleAddManualEvent, handleDeleteManualEvent,
  };
}
