import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, CalendarEvent, Habit, HabitLog } from "../types";
import { DEFAULT_TASKS } from "../lib/defaultTasks";
import { readJSON, writeJSON } from "../lib/safeStorage";

interface Options {
  pushToast: (t: { icon?: string; tone?: "success" | "warn" | "info"; message: string }) => void;
}

/**
 * Owns the app's core persisted collections (tasks, events, habits,
 * habit log) plus their setter+persist helpers. Storage failures are
 * surfaced once per session via a toast instead of crashing the app.
 */
export function useAppData({ pushToast }: Options) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLog, setHabitLog] = useState<HabitLog>({});

  // Hydrate from localStorage after mount (safe against SSR).
  useEffect(() => {
    const savedTasks = readJSON<Task[] | null>("goblin_tasks", null);
    setTasks(Array.isArray(savedTasks) ? savedTasks : DEFAULT_TASKS);

    const savedEvents = readJSON<CalendarEvent[] | null>("goblin_events", null);
    setManualEvents(Array.isArray(savedEvents) ? savedEvents : []);

    const savedHabits = readJSON<Habit[] | null>("goblin_habits", null);
    if (Array.isArray(savedHabits)) setHabits(savedHabits);

    const savedHabitLog = readJSON<HabitLog | null>("goblin_habit_log", null);
    if (savedHabitLog && typeof savedHabitLog === "object") setHabitLog(savedHabitLog);
  }, []);

  const storageWarnedRef = useRef(false);
  const handleStorageError = useCallback((err: unknown) => {
    if (storageWarnedRef.current) return;
    storageWarnedRef.current = true;
    const quota = err instanceof DOMException && err.name === "QuotaExceededError";
    pushToast({
      icon: "⚠️",
      tone: "warn",
      message: quota
        ? "Local storage is full — changes stay in this tab only."
        : "Couldn't save to local storage — changes stay in this tab only.",
    });
  }, [pushToast]);

  const syncTasks = useCallback((updated: Task[]) => {
    setTasks(updated);
    writeJSON("goblin_tasks", updated, { onError: handleStorageError });
  }, [handleStorageError]);

  const syncEvents = useCallback((updated: CalendarEvent[]) => {
    setManualEvents(updated);
    writeJSON("goblin_events", updated, { onError: handleStorageError });
  }, [handleStorageError]);

  const syncHabits = useCallback((updated: Habit[]) => {
    setHabits(updated);
    writeJSON("goblin_habits", updated, { onError: handleStorageError });
  }, [handleStorageError]);

  const syncHabitLog = useCallback((updated: HabitLog) => {
    setHabitLog(updated);
    writeJSON("goblin_habit_log", updated, { onError: handleStorageError });
  }, [handleStorageError]);

  return {
    tasks, setTasks, syncTasks,
    manualEvents, setManualEvents, syncEvents,
    habits, syncHabits,
    habitLog, syncHabitLog,
  };
}
