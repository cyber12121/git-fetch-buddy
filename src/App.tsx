import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";

import { motion, AnimatePresence } from "motion/react";
import { Task, CalendarEvent, Habit, HabitLog, HabitDayStatus } from "./types";
import GubbyCompanion from "./components/GubbyCompanion";
import AppNav from "./components/AppNav";
import SideNav from "./components/SideNav";
import TodaysQuests from "./components/TodaysQuests";
import ErrorBoundary from "./components/ErrorBoundary";
import AppStatusBar from "./components/AppStatusBar";

import { useToast } from "./components/Toast";
import { useCloudSync } from "./hooks/useCloudSync";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./lib/googleCalendar";
import { estimateTaskDuration, toLocalDateKey } from "./lib/constants";
import { DEFAULT_TASKS } from "./lib/defaultTasks";
import { readJSON, writeJSON } from "./lib/safeStorage";
import confetti from "canvas-confetti";

// Code-split every workspace module so the initial bundle only carries the
// shell (nav, companion, status bar). Each module's chunk is fetched the
// first time its tab is opened (or when the nav pre-warms it on hover).
const CompilerModule = lazy(() => import("./components/CompilerModule"));
const MagicTodoModule = lazy(() => import("./components/MagicTodoModule"));
const TaskmasterModule = lazy(() => import("./components/TaskmasterModule"));
const CalendarModule = lazy(() => import("./components/CalendarModule"));
const WeeklyPlannerModule = lazy(() => import("./components/WeeklyPlannerModule"));
const HabitTrackerModule = lazy(() => import("./components/HabitTrackerModule"));

// Map of tab id → dynamic import, used by AppNav to prefetch a module's
// chunk on hover/focus so the first click feels instant.
const MODULE_PREFETCH: Record<string, () => Promise<unknown>> = {
  compiler: () => import("./components/CompilerModule"),
  todo: () => import("./components/MagicTodoModule"),
  taskmaster: () => import("./components/TaskmasterModule"),
  calendar: () => import("./components/CalendarModule"),
  weekly: () => import("./components/WeeklyPlannerModule"),
  habits: () => import("./components/HabitTrackerModule"),
};



export default function App() {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<"compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits">("todo");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateKey());

  // Sprig companion custom reactive state
  const [gubbyMessage, setGubbyMessage] = useState<string>(
    "Welcome to Goblin Flow! Sprig is here to help you defeat task paralysis. Where should we start?"
  );
  const [gubbyMood, setGubbyMood] = useState<"happy" | "thoughtful" | "focused" | "cozy" | "excited">("cozy");

  // Sprig can be hidden to reduce on-screen clutter; the choice persists so it
  // isn't re-shown on every reload. Reading localStorage in a useState
  // initializer would hydration-mismatch (SSR sees no storage), so hydrate
  // the stored value in an effect after mount.
  const [gubbyHidden, setGubbyHiddenState] = useState<boolean>(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("goblin_gubby_hidden") === "1") setGubbyHiddenState(true);
    } catch { /* ignore */ }
  }, []);
  const updateGubbyHidden = useCallback((hidden: boolean) => {
    setGubbyHiddenState(hidden);
    try {
      localStorage.setItem("goblin_gubby_hidden", hidden ? "1" : "0");
    } catch {
      /* ignore persistence failures (e.g. private mode) */
    }
  }, []);

  // Stable so it can be passed to the extracted hooks without breaking memoization.
  const triggerGubbySpeak = useCallback((msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => {
    setGubbyMessage(msg);
    setGubbyMood(mood);
  }, []);

  // State loaded in Taskmaster Focus
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);

  // Habit Tracker state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLog, setHabitLog] = useState<HabitLog>({});

  // Sprig growth pet: XP awarded for completions. Persisted locally + synced to
  // cloud. Hydrate from localStorage after mount to avoid SSR hydration
  // mismatches.
  const [xp, setXp] = useState<number>(0);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("goblin_xp") || "0");
      if (Number.isFinite(saved) && saved > 0) setXp(saved);
    } catch { /* ignore */ }
  }, []);
  const addXp = useCallback((amount: number) => {
    setXp((prev) => {
      const next = Math.max(0, prev + amount);
      try { localStorage.setItem("goblin_xp", String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Sync helpers: update React state AND mirror to localStorage. Passed to the
  // cloud-sync hook so pulled data persists locally too. Writes go through
  // safeStorage so a full quota / disabled storage does NOT crash the app —
  // we keep the in-memory update and warn the user once per session.
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

  const syncTasks = useCallback((updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    writeJSON("goblin_tasks", updatedTasks, { onError: handleStorageError });
  }, [handleStorageError]);
  const syncEvents = useCallback((updatedEvents: CalendarEvent[]) => {
    setManualEvents(updatedEvents);
    writeJSON("goblin_events", updatedEvents, { onError: handleStorageError });
  }, [handleStorageError]);
  const syncHabits = useCallback((updated: Habit[]) => {
    setHabits(updated);
    writeJSON("goblin_habits", updated, { onError: handleStorageError });
  }, [handleStorageError]);
  const syncHabitLog = useCallback((updated: HabitLog) => {
    setHabitLog(updated);
    writeJSON("goblin_habit_log", updated, { onError: handleStorageError });
  }, [handleStorageError]);

  // ─── Auth + Google Calendar session (extracted into a hook) ───────────────
  const { user, accessToken, googleEvents, isLoadingGoogle, googleError, setIsLoadingGoogle, loadGoogleEvents, handleConnectGoogle, handleDisconnectGoogle, handleSignOut } = useGoogleCalendar({
    selectedDate,
    onMessage: triggerGubbySpeak,
    setManualEvents,
  });

  // ─── Cloud sync to Firestore (extracted into a hook) ─────────────────────
  const { cloudStatus } = useCloudSync({
    user,
    tasks,
    manualEvents,
    habits,
    habitLog,
    syncTasks,
    syncEvents,
    syncHabits,
    syncHabitLog,
    setXp,
  });

  // Load from local storage. safeStorage.readJSON handles missing / disabled
  // storage, parse failures, and clears corrupted values so a single bad key
  // can't wedge the whole app on startup.
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

  // Celebrate when Sprig levels up. Use a sentinel so the first observation of
  // `xp` (either the initial 0, the hydrated localStorage value, or the merged
  // cloud value on sign-in) seeds the baseline instead of firing a bogus
  // "level up!" burst on every reload.
  const prevLevelRef = useRef<number | null>(null);
  useEffect(() => {
    const lvl = Math.floor(xp / 100) + 1;
    if (prevLevelRef.current !== null && lvl > prevLevelRef.current) {
      triggerGubbySpeak(`Sprig grew to Level ${lvl}! 🎉 You're a mightier goblin with every quest.`, "excited");
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
        colors: ["#F27D26", "#556B55", "#FFD4A3", "#FBBF24"],
      });
    }
    prevLevelRef.current = lvl;
  }, [xp, triggerGubbySpeak]);

  const handleAddHabit = (name: string, color: string) => {
    const newHabit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    syncHabits([...habits, newHabit]);
  };

  const handleDeleteHabit = (id: string) => {
    syncHabits(habits.filter(h => h.id !== id));
    // Also clean up log entries for this habit
    const updatedLog = { ...habitLog };
    for (const key of Object.keys(updatedLog)) {
      if (key.startsWith(`${id}:`)) delete updatedLog[key];
    }
    syncHabitLog(updatedLog);
  };

  const handleToggleHabitDay = (habitId: string, date: string) => {
    const key = `${habitId}:${date}`;
    const current: HabitDayStatus = habitLog[key] || "none";
    const cycle: Record<HabitDayStatus, HabitDayStatus> = { none: "done", done: "skip", skip: "none" };
    const next = cycle[current];
    const updatedLog = { ...habitLog };
    if (next === "none") {
      delete updatedLog[key];
    } else {
      updatedLog[key] = next;
    }
    syncHabitLog(updatedLog);
    if (next === "done") addXp(5);
    else if (current === "done") addXp(-5);
  };

  // Callback handlers
  const handleAddTask = async (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string, estimatedMinutes?: number) => {
    let googleEventId: string | undefined = undefined;

    if (scheduledDate && accessToken) {
      setIsLoadingGoogle(true);
      try {
        const gEvent = await createGoogleCalendarEvent(accessToken, `🎯 Quest: ${title}`, scheduledDate);
        if (gEvent && gEvent.id) {
          googleEventId = gEvent.id;
          loadGoogleEvents(accessToken);
        }
      } catch (err) {
        console.error("Failed to automatically sync scheduled task to Google Calendar", err);
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
      estimatedMinutes: estimatedMinutes !== undefined ? estimatedMinutes : estimateTaskDuration(title)
    };
    const updated = [...tasks, newTask];
    syncTasks(updated);
  };

  const handleDeleteTask = async (id: string) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (taskToDelete && taskToDelete.googleEventId && accessToken) {
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
    const updated = tasks.filter((t) => t.id !== id);
    syncTasks(updated);
    pushToast({ icon: "🗑️", message: "Quest deleted", tone: "warn" });
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        if (nextCompleted) {
          addXp(15);
          setGubbyMood("happy");
          setGubbyMessage(`Hurray! Quest "${t.title}" is finished! Gold leaf for you! 🍃✨`);
          pushToast({ icon: "✅", message: "Quest done! +15 XP", tone: "success" });

          // Trigger confetti burst celebration
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#F27D26', '#556B55', '#FFD4A3', '#FBBF24']
          });
        } else {
          addXp(-15);
        }
        return { ...t, completed: nextCompleted };
      }
      return t;
    });
    syncTasks(updated);
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const taskToUpdate = tasks.find((t) => t.id === id);
    if (!taskToUpdate) return;

    let updatedGoogleEventId = taskToUpdate.googleEventId;

    if (accessToken) {
      const titleChanged = updates.title !== undefined && updates.title !== taskToUpdate.title;
      const dateChanged = updates.scheduledDate !== undefined && updates.scheduledDate !== taskToUpdate.scheduledDate;

      if (taskToUpdate.googleEventId) {
        // If the date was removed, delete the Google event
        if (updates.scheduledDate === null || (updates.scheduledDate === undefined && dateChanged && !updates.scheduledDate)) {
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
          // If title or date changed, we can update or recreate
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
        // If it didn't have a Google Event but now has a scheduledDate
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

    const updated = tasks.map((t) => {
      if (t.id === id) {
        return { ...t, ...updates, googleEventId: updatedGoogleEventId };
      }
      return t;
    });
    syncTasks(updated);
  };

  // Handler for Brain Dump Compiler
  const handleTasksCompiled = (newCompiled: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">[]) => {
    const formatted: Task[] = newCompiled.map((t, idx) => ({
      id: `task-compiled-${Date.now()}-${idx}`,
      title: t.title,
      priority: t.priority,
      notes: t.notes || "Compiled from brain dump. Go time!",
      completed: false,
      subtasks: [],
      createdAt: new Date().toISOString(),
      estimatedMinutes: estimateTaskDuration(t.title)
    }));

    syncTasks([...formatted, ...tasks]);
    setActiveTab("todo");
  };

  // Handoff focus from checklist to Taskmaster countdown
  const handleFocusTask = (
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
  };

  // Marks focused task completed in the master list (matched by ID, not title)
  const handleCompleteActiveTask = (taskId: string, subtaskId?: string) => {
    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (subtaskId) {
        const sub = t.subtasks.find((s) => s.id === subtaskId);
        if (sub && !sub.completed) addXp(3);
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: true } : s
          ),
        };
      }
      if (!t.completed) addXp(15);
      return { ...t, completed: true };
    });
    syncTasks(updated);

    // Clear the active focus pointer once its quest is done. Taskmaster keys its
    // timer reload off activeTaskTitle changes, so without this, re-clicking
    // "Focus" on the same (now-completed) task would silently do nothing.
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    setActiveSubtaskId(null);
  };

  const handleAddManualEvent = (eventData: Omit<CalendarEvent, "id">) => {
    const newEvent: CalendarEvent = {
      id: `event-manual-${Date.now()}`,
      ...eventData
    };
    syncEvents([...manualEvents, newEvent]);
  };

  const handleDeleteManualEvent = async (id: string) => {
    const eventToDelete = manualEvents.find((evt) => evt.id === id);
    if (eventToDelete && accessToken && eventToDelete.googleEventId) {
      // Delete the linked Google Calendar event directly by its stored ID
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
  };

  return (
    <div id="goblin-flow-root" className={`min-h-dvh flex flex-col font-sans antialiased transition-colors duration-150 ${
      activeTab === "weekly" || activeTab === "calendar"
        ? "bg-canvas text-ink pb-20 md:pb-0"
        : "bg-canvas text-ink-2 pb-24 md:pb-16"
    }`}>

      
      {/* 2. Top Navigation Bar — Single Line Premium Layout */}
      <AppNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as "compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits")}
        onGubbyMessage={triggerGubbySpeak}
        onPrefetchTab={(tab) => { MODULE_PREFETCH[tab]?.().catch(() => {}); }}
        xp={xp}
      />


      {/* 3. Layout: full-width horizontal for planning tabs (calendar, weekly, habits);
          three-column dashboard for do-tabs on desktop. */}
      {(() => {
        const isWide = activeTab === "weekly" || activeTab === "calendar" || activeTab === "habits";
        return (
      <div className={`flex-1 w-full ${
        isWide ? (activeTab === "weekly" ? "p-0" : "max-w-[1400px] mx-auto px-4 mt-6") : "max-w-[1400px] mx-auto px-4 mt-6"
      }`}>
        <div className={`${
          isWide
            ? "block"
            : "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_20rem] lg:gap-6 lg:items-start"
        }`}>
          {/* LEFT: sidebar nav + tip (desktop only, do-tabs only) */}
          {!isWide && (
            <SideNav
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as "compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits")}
              onGubbyMessage={triggerGubbySpeak}
              onPrefetchTab={(tab) => { MODULE_PREFETCH[tab]?.().catch(() => {}); }}
              taskCount={tasks.filter(t => !t.completed).length}
            />
          )}

          {/* CENTER: active module */}
          <main className={`min-w-0 ${isWide ? "w-full" : ""}`}>

            <ErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center py-16 text-ink-muted text-sm">Sprig is warming up… 🍄</div>
              }>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="w-full"
                  >
                    {activeTab === "compiler" && (
                      <CompilerModule
                        onTasksCompiled={handleTasksCompiled}
                        onGubbyMessage={triggerGubbySpeak}
                      />
                    )}

                    {activeTab === "todo" && (
                      <MagicTodoModule
                        tasks={tasks}
                        onAddTask={handleAddTask}
                        onDeleteTask={handleDeleteTask}
                        onToggleTask={handleToggleTask}
                        onUpdateTask={handleUpdateTask}
                        onFocusTask={handleFocusTask}
                        onFocusAndSwitch={(taskTitle, taskId) => {
                          handleFocusTask(taskTitle, undefined, taskId);
                        }}
                        onGainXp={addXp}
                        onGubbyMessage={triggerGubbySpeak}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                      />
                    )}

                    {activeTab === "taskmaster" && (
                      <TaskmasterModule
                        activeTaskTitle={activeTaskTitle}
                        activeTaskId={activeTaskId}
                        activeSubtaskId={activeSubtaskId}
                        tasks={tasks}
                        onCompleteActiveTask={handleCompleteActiveTask}
                        onGubbyMessage={triggerGubbySpeak}
                      />
                    )}

                    {activeTab === "calendar" && (
                      <CalendarModule
                        tasks={tasks}
                        manualEvents={manualEvents}
                        onAddManualEvent={handleAddManualEvent}
                        onDeleteManualEvent={handleDeleteManualEvent}
                        onDeleteTask={handleDeleteTask}
                        onFocusTask={handleFocusTask}
                        onGubbyMessage={triggerGubbySpeak}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        onAddTask={handleAddTask}
                        googleEvents={googleEvents}
                        isLoadingGoogle={isLoadingGoogle}
                        googleError={googleError}
                        user={user}
                        accessToken={accessToken}
                        calendarConnected={!!(user && accessToken)}
                        onConnectGoogle={handleConnectGoogle}
                        onDisconnectGoogle={handleDisconnectGoogle}
                        onSignOut={handleSignOut}
                        onLoadGoogleEvents={loadGoogleEvents}
                      />
                    )}

                    {activeTab === "weekly" && (
                      <WeeklyPlannerModule
                        tasks={tasks}
                        onAddTask={handleAddTask}
                        onDeleteTask={handleDeleteTask}
                        onToggleTask={handleToggleTask}
                        onUpdateTask={handleUpdateTask}
                        onUpdateTasksList={syncTasks}
                        onGubbyMessage={triggerGubbySpeak}
                        manualEvents={manualEvents}
                        onDeleteManualEvent={handleDeleteManualEvent}
                      />
                    )}

                    {activeTab === "habits" && (
                      <HabitTrackerModule
                        habits={habits}
                        habitLog={habitLog}
                        onAddHabit={handleAddHabit}
                        onDeleteHabit={handleDeleteHabit}
                        onToggleDay={handleToggleHabitDay}
                        onGubbyMessage={triggerGubbySpeak}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </main>

          {/* RIGHT: Sprig companion + Today's Quests (desktop only, do-tabs only) */}
          {!isWide && (
            <aside className="hidden lg:flex flex-col gap-4 w-80 shrink-0">
              {!gubbyHidden ? (
                <GubbyCompanion
                  mood={gubbyMood}
                  customMessage={gubbyMessage}
                  xp={xp}
                  onHide={() => updateGubbyHidden(true)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => updateGubbyHidden(false)}
                  className="text-xs font-bold text-ink-muted hover:text-brand bg-surface border border-edge rounded-full px-3 py-2 shadow-sm self-end"
                >
                  🦦 Bring Sprig back
                </button>
              )}
              <TodaysQuests tasks={tasks} onToggleTask={handleToggleTask} />
            </aside>
          )}
        </div>

        {/* Mobile/tablet: inline Sprig below the module (unchanged behavior) */}
        {activeTab !== "weekly" && activeTab !== "calendar" && activeTab !== "habits" && !gubbyHidden && (
          <section aria-label="Sprig companion" className="lg:hidden mt-6">
            <GubbyCompanion mood={gubbyMood} customMessage={gubbyMessage} xp={xp} onHide={() => updateGubbyHidden(true)} />
          </section>
        )}
      </div>
        );
      })()}

      {/* 4. Footer Status Bar */}
      {activeTab !== "weekly" && <AppStatusBar user={user} cloudStatus={cloudStatus} />}


    </div>
  );
}

