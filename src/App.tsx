import React, { useState, useEffect, useCallback, useRef, lazy, Suspense, type ReactNode } from "react";

import { motion, AnimatePresence } from "motion/react";
import { Task, CalendarEvent, Habit, HabitLog, HabitDayStatus } from "./types";
import GubbyCompanion from "./components/GubbyCompanion";
import AppNav from "./components/AppNav";
import { useToast } from "./components/Toast";
import { useCloudSync } from "./hooks/useCloudSync";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";
import CompilerModule from "./components/CompilerModule";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./lib/googleCalendar";
import { estimateTaskDuration, toLocalDateKey } from "./lib/constants";
import confetti from "canvas-confetti";

// Code-split the heavier modules so they load only when their tab opens.
const MagicTodoModule = lazy(() => import("./components/MagicTodoModule").then(m => ({ default: m.default })));
const TaskmasterModule = lazy(() => import("./components/TaskmasterModule").then(m => ({ default: m.default })));
const CalendarModule = lazy(() => import("./components/CalendarModule").then(m => ({ default: m.default })));
const WeeklyPlannerModule = lazy(() => import("./components/WeeklyPlannerModule").then(m => ({ default: m.default })));
const HabitTrackerModule = lazy(() => import("./components/HabitTrackerModule").then(m => ({ default: m.default })));

// Graceful fallback so an unexpected throw doesn't white-screen the whole app.
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Goblin Flow crashed:", error);
  }
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-8 text-center">
          <div className="bg-surface-sunken/90 rounded-2xl p-6 shadow-md max-w-md">
            <div className="text-3xl mb-2" aria-hidden="true">🍄</div>
            <h2 className="font-bold text-ink mb-1">Something wobbled!</h2>
            <p className="text-sm text-ink-muted mb-3">Gubby hit a snag. Try refreshing — your tasks are safe in local storage.</p>
            <button
              type="button"
              onClick={() => (this as any).setState({ error: null })}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        </div>

      );
    }
    return (this as any).props.children;
  }
}


// Graceful fallback so an unexpected throw doesn't white-screen the whole app.


// High-value default tasks for standard ADHD-friendly initial onboarding
const DEFAULT_TASKS: Task[] = [
  {
    id: "default-task-1",
    title: "Gather cozy moss from the forest brook",
    priority: "medium",
    notes: "Requires rubber boots and a tiny container. Damp soil smells amazing!",
    completed: false,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 30,
    subtasks: [
      { id: "def-sub-1", title: "Put on waterproof boots 🥾", completed: true },
      { id: "def-sub-2", title: "Locate damp, shaded log near riverbank", completed: false },
      { id: "def-sub-3", title: "Gently scoop a handful of moss", completed: false }
    ],
    scheduledDate: toLocalDateKey() // today
  },
  {
    id: "default-task-2",
    title: "Clean the terrifying messy room heap",
    priority: "high",
    notes: "It has been staring at me for 3 weeks. High threat level!",
    completed: false,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 45,
    subtasks: [
      { id: "def-sub-4", title: "Pick up exactly 3 pieces of paper from floor", completed: false },
      { id: "def-sub-5", title: "Put exactly 1 dirty shirt in the basket", completed: false },
      { id: "def-sub-6", title: "Open a window to let fresh air in 💨", completed: false }
    ]
  },
  {
    id: "default-task-3",
    title: "Polish the shiny goblin crown 👑",
    priority: "low",
    notes: "A quick, satisfying win to boost dopamine!",
    completed: true,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 10,
    subtasks: []
  }
];

export default function App() {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<"compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits">("todo");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [manualEvents, setManualEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateKey());

  // Gubby companion custom reactive state
  const [gubbyMessage, setGubbyMessage] = useState<string>(
    "Welcome to Goblin Flow! Gubby is here to help you defeat task paralysis. Where should we start?"
  );
  const [gubbyMood, setGubbyMood] = useState<"happy" | "thoughtful" | "focused" | "cozy" | "excited">("cozy");

  // Gubby can be hidden to reduce on-screen clutter; the choice persists so it
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

  // Gubby growth pet: XP awarded for completions. Persisted locally + synced to
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
  // cloud-sync hook so pulled data persists locally too.
  const syncTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem("goblin_tasks", JSON.stringify(updatedTasks));
  };
  const syncEvents = (updatedEvents: CalendarEvent[]) => {
    setManualEvents(updatedEvents);
    localStorage.setItem("goblin_events", JSON.stringify(updatedEvents));
  };
  const syncHabits = (updated: Habit[]) => {
    setHabits(updated);
    localStorage.setItem("goblin_habits", JSON.stringify(updated));
  };
  const syncHabitLog = (updated: HabitLog) => {
    setHabitLog(updated);
    localStorage.setItem("goblin_habit_log", JSON.stringify(updated));
  };

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

  // Load from local storage
  useEffect(() => {
    const savedTasks = localStorage.getItem("goblin_tasks");
    const savedEvents = localStorage.getItem("goblin_events");

    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error("Failed to parse saved tasks", e);
        setTasks(DEFAULT_TASKS);
      }
    } else {
      setTasks(DEFAULT_TASKS);
    }

    if (savedEvents) {
      try {
        setManualEvents(JSON.parse(savedEvents));
      } catch (e) {
        console.error("Failed to parse saved events", e);
        setManualEvents([]);
      }
    }

    // Load habits
    const savedHabits = localStorage.getItem("goblin_habits");
    if (savedHabits) {
      try { setHabits(JSON.parse(savedHabits)); } catch (e) { console.error("Failed to parse saved habits", e); }
    }
    const savedHabitLog = localStorage.getItem("goblin_habit_log");
    if (savedHabitLog) {
      try { setHabitLog(JSON.parse(savedHabitLog)); } catch (e) { console.error("Failed to parse saved habit log", e); }
    }
  }, []);

  // Celebrate when Gubby levels up.
  const prevLevelRef = useRef<number>(Math.floor(xp / 100) + 1);
  useEffect(() => {
    const lvl = Math.floor(xp / 100) + 1;
    if (lvl > prevLevelRef.current) {
      triggerGubbySpeak(`Gubby grew to Level ${lvl}! 🎉 You're a mightier goblin with every quest.`, "excited");
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
        colors: ["#F27D26", "#556B55", "#FFD4A3", "#FBBF24"],
      });
    }
    prevLevelRef.current = lvl;
  }, [xp]);

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
        xp={xp}
      />

      {/* 3. Global Gubby Companion Layer — inline on every breakpoint. */}
      {activeTab !== "weekly" && activeTab !== "calendar" && activeTab !== "habits" && (
        gubbyHidden ? (
          <div className="px-4 mt-6 max-w-5xl mx-auto w-full flex justify-end">
            <button
              type="button"
              onClick={() => updateGubbyHidden(false)}
              aria-label="Bring Gubby companion back"
              className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-brand bg-surface border border-edge rounded-full px-3 py-2 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              🦦 Bring Gubby back
            </button>
          </div>
        ) : (
          <section
            aria-label="Gubby companion"
            className="px-4 mt-6 max-w-5xl mx-auto w-full"
          >
            <GubbyCompanion mood={gubbyMood} customMessage={gubbyMessage} xp={xp} onHide={() => updateGubbyHidden(true)} />
          </section>
        )
      )}



      {/* 4. Active Workspace Modules */}
      <main className={`flex-1 ${
        activeTab === "weekly"
          ? "w-full p-0"
          : activeTab === "calendar" || activeTab === "habits"
            ? "w-full pb-20"
            : "px-4 mt-6 max-w-5xl mx-auto w-full"
      }`}>
        <ErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center py-16 text-ink-muted text-sm">Gubby is warming up… 🍄</div>
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

      {/* 5. Footer Status Bar (Simplified layout for less visual noise) */}
      {activeTab !== "weekly" && (
        <footer className="hidden md:flex fixed bottom-0 left-0 right-0 h-9 bg-surface-sunken/95 backdrop-blur-md border-t border-edge px-6 items-center justify-between text-[11px] font-bold text-ink-muted z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-brand rounded-full"></div> Goblin Flow Active</span>
            {user && (
              <span className="flex items-center gap-1.5">
                {cloudStatus === "syncing" && (<><div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div> Syncing…</>)}
                {cloudStatus === "synced" && (<><div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div> Cloud synced</>)}
                {cloudStatus === "error" && (<><div className="w-1.5 h-1.5 bg-rose-400 rounded-full"></div> Sync off</>)}
                {cloudStatus === "local" && (<><div className="w-1.5 h-1.5 bg-surface-disabled rounded-full"></div> Local only</>)}
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <span className="flex items-center gap-1.5 text-emerald-600/70"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div> Auto-saving</span>
          </div>
        </footer>
      )}

    </div>
  );
}
