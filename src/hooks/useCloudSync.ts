import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Task, CalendarEvent, Habit, HabitLog } from "../types";
import { loadUserData, saveUserData } from "../lib/firestoreSync";

/** Union two id-keyed arrays, keeping cloud items and adding local-only ones. */
function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const cloudIds = new Set(cloud.map((c) => c.id));
  return [...cloud, ...local.filter((l) => !cloudIds.has(l.id))];
}

/**
 * Merge two habit logs, preferring a real status (done/skip) over "none" so a
 * locally-checked day is never overwritten by a stale cloud "none".
 */
function mergeHabitLog(local: HabitLog, cloud: HabitLog): HabitLog {
  const out: HabitLog = { ...cloud };
  for (const [key, status] of Object.entries(local)) {
    if (status !== "none") out[key] = status;
  }
  return out;
}

interface UseCloudSyncArgs {
  user: User | null;
  tasks: Task[];
  manualEvents: CalendarEvent[];
  habits: Habit[];
  habitLog: HabitLog;
  /** Live XP value — must be in deps so cloud push fires on XP-only changes. */
  xp: number;
  syncTasks: (tasks: Task[]) => void;
  syncEvents: (events: CalendarEvent[]) => void;
  syncHabits: (habits: Habit[]) => void;
  syncHabitLog: (log: HabitLog) => void;
  setXp: (value: number | ((prev: number) => number)) => void;
  /** Optional toast surface so cloud-sync failures don't die silently. */
  pushToast?: (t: { icon?: string; tone?: "success" | "warn" | "info"; message: string }) => void;
}

/**
 * Mirrors Goblin Flow state to a per-user Firestore document.
 *
 * - On sign-in: PULL and MERGE with local data (union by id) instead of
 *   overwriting, so tasks/edits made on another device or before sign-in are
 *   preserved rather than silently dropped.
 * - XP is merged (max of local vs cloud) and pushed into React state, fixing a
 *   bug where cloud XP was written to localStorage but never reflected in the UI.
 * - After the initial pull, local changes are debounced-saved back to the cloud.
 */
export function useCloudSync({
  user,
  tasks,
  manualEvents,
  habits,
  habitLog,
  xp,
  syncTasks,
  syncEvents,
  syncHabits,
  syncHabitLog,
  setXp,
  pushToast,
}: UseCloudSyncArgs) {
  const [cloudStatus, setCloudStatus] = useState<"local" | "syncing" | "synced" | "error">("local");
  const cloudReadyRef = useRef(false);
  // Toast only the FIRST save-failure per run so we don't spam the user
  // when the debounced writer retries every keystroke against a broken link.
  const saveErrorNoticedRef = useRef(false);

  // Pull (and merge) on sign-in; push initial data if the user is brand new.
  useEffect(() => {
    if (!user) {
      cloudReadyRef.current = false;
      setCloudStatus("local");
      return;
    }
    let cancelled = false;
    setCloudStatus("syncing");
    loadUserData(user.uid)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          syncTasks(mergeById(tasks, data.tasks));
          syncEvents(mergeById(manualEvents, data.manualEvents));
          syncHabits(mergeById(habits, data.habits));
          syncHabitLog(mergeHabitLog(habitLog, data.habitLog));

          // Merge XP so neither local nor cloud progress is lost.
          const localXp = Number(localStorage.getItem("goblin_xp") || "0");
          const cloudXp = typeof data.xp === "number" ? data.xp : 0;
          const mergedXp = Math.max(localXp, cloudXp);
          localStorage.setItem("goblin_xp", String(mergedXp));
          setXp(mergedXp);
        } else {
          void saveUserData(user.uid, {
            tasks,
            manualEvents,
            habits,
            habitLog,
            xp: Number(localStorage.getItem("goblin_xp") || "0"),
            updatedAt: Date.now(),
          });
        }
        cloudReadyRef.current = true;
        setCloudStatus("synced");
      })
      .catch((err) => {
        console.warn("Cloud sync unavailable, staying on local storage:", err);
        cloudReadyRef.current = true;
        setCloudStatus("error");
        pushToast?.({
          icon: "☁️",
          tone: "warn",
          message: "Couldn't reach the cloud — your quests are safe locally.",
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Mirror local state to the cloud (debounced) once the initial pull completed.
  useEffect(() => {
    if (!user || !cloudReadyRef.current) return;
    const handle = setTimeout(() => {
      void saveUserData(user.uid, {
        tasks,
        manualEvents,
        habits,
        habitLog,
        xp: Number(localStorage.getItem("goblin_xp") || "0"),
        updatedAt: Date.now(),
      })
        .then(() => {
          setCloudStatus("synced");
          saveErrorNoticedRef.current = false;
        })
        .catch((err) => {
          console.warn("Cloud save failed:", err);
          setCloudStatus("error");
          if (!saveErrorNoticedRef.current) {
            saveErrorNoticedRef.current = true;
            pushToast?.({
              icon: "☁️",
              tone: "warn",
              message: "Cloud save failed — changes are still saved locally.",
            });
          }
        });
    }, 800);
    return () => clearTimeout(handle);
  }, [tasks, manualEvents, habits, habitLog, user]);

  return { cloudStatus };
}
