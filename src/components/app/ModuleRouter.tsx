import { lazy, memo, Suspense } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { User } from "firebase/auth";
import type { Task, CalendarEvent, Habit, HabitLog } from "../../types";
import ErrorBoundary from "../ErrorBoundary";

// Code-split every workspace module so the initial bundle only carries the
// shell. Each chunk is fetched the first time its tab is opened.
const CompilerModule = lazy(() => import("../CompilerModule"));
const MagicTodoModule = lazy(() => import("../MagicTodoModule"));
const TaskmasterModule = lazy(() => import("../TaskmasterModule"));
const CalendarModule = lazy(() => import("../CalendarModule"));
const WeeklyPlannerModule = lazy(() => import("../WeeklyPlannerModule"));
const HabitTrackerModule = lazy(() => import("../HabitTrackerModule"));

export type TabId = "compiler" | "todo" | "taskmaster" | "calendar" | "weekly" | "habits";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

export interface ModuleRouterProps {
  activeTab: TabId;
  tasks: Task[];
  manualEvents: CalendarEvent[];
  habits: Habit[];
  habitLog: HabitLog;
  selectedDate: string;
  onSelectDate: (d: string) => void;

  activeTaskTitle: string | null;
  activeTaskId: string | null;
  activeSubtaskId: string | null;

  // Google Calendar session
  googleEvents: CalendarEvent[];
  isLoadingGoogle: boolean;
  googleError: string | null;
  user: unknown;
  accessToken: string | null;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSignOut: () => void;
  onLoadGoogleEvents: (token: string) => void;

  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  onGainXp: (n: number) => void;

  // Task handlers
  onAddTask: (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string, estimatedMinutes?: number) => Promise<void> | void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void> | void;
  onUpdateTasksList: (tasks: Task[]) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onCompleteActiveTask: (taskId: string, subtaskId?: string) => void;
  onTasksCompiled: (compiled: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">[]) => void;

  onAddManualEvent: (data: Omit<CalendarEvent, "id">) => void;
  onDeleteManualEvent: (id: string) => void;

  onAddHabit: (name: string, color: string) => void;
  onDeleteHabit: (id: string) => void;
  onToggleHabitDay: (habitId: string, date: string) => void;
}

/**
 * Renders the currently-active workspace module inside an error boundary
 * and a suspense fallback, wrapped in a shared motion transition.
 *
 * Memoized so switching unrelated global state (theme, gubby message, etc.)
 * doesn't re-render every lazy module — only prop changes to *this*
 * component do.
 */
function ModuleRouterImpl(p: ModuleRouterProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center py-16 text-ink-muted text-sm">Sprig is warming up… 🍄</div>
      }>
        <AnimatePresence mode="wait">
          <motion.div
            key={p.activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {p.activeTab === "compiler" && (
              <CompilerModule onTasksCompiled={p.onTasksCompiled} onGubbyMessage={p.onGubbyMessage} />
            )}

            {p.activeTab === "todo" && (
              <MagicTodoModule
                tasks={p.tasks}
                onAddTask={p.onAddTask}
                onDeleteTask={p.onDeleteTask}
                onToggleTask={p.onToggleTask}
                onUpdateTask={p.onUpdateTask}
                onFocusTask={p.onFocusTask}
                onFocusAndSwitch={(taskTitle, taskId) => p.onFocusTask(taskTitle, undefined, taskId)}
                onGainXp={p.onGainXp}
                onGubbyMessage={p.onGubbyMessage}
                selectedDate={p.selectedDate}
                onSelectDate={p.onSelectDate}
              />
            )}

            {p.activeTab === "taskmaster" && (
              <TaskmasterModule
                activeTaskTitle={p.activeTaskTitle}
                activeTaskId={p.activeTaskId}
                activeSubtaskId={p.activeSubtaskId}
                tasks={p.tasks}
                onCompleteActiveTask={p.onCompleteActiveTask}
                onGubbyMessage={p.onGubbyMessage}
              />
            )}

            {p.activeTab === "calendar" && (
              <CalendarModule
                tasks={p.tasks}
                manualEvents={p.manualEvents}
                onAddManualEvent={p.onAddManualEvent}
                onDeleteManualEvent={p.onDeleteManualEvent}
                onDeleteTask={p.onDeleteTask}
                onFocusTask={p.onFocusTask}
                onGubbyMessage={p.onGubbyMessage}
                selectedDate={p.selectedDate}
                onSelectDate={p.onSelectDate}
                onAddTask={p.onAddTask}
                googleEvents={p.googleEvents}
                isLoadingGoogle={p.isLoadingGoogle}
                googleError={p.googleError}
                user={p.user}
                accessToken={p.accessToken}
                calendarConnected={!!(p.user && p.accessToken)}
                onConnectGoogle={p.onConnectGoogle}
                onDisconnectGoogle={p.onDisconnectGoogle}
                onSignOut={p.onSignOut}
                onLoadGoogleEvents={p.onLoadGoogleEvents}
              />
            )}

            {p.activeTab === "weekly" && (
              <WeeklyPlannerModule
                tasks={p.tasks}
                onAddTask={p.onAddTask}
                onDeleteTask={p.onDeleteTask}
                onToggleTask={p.onToggleTask}
                onUpdateTask={p.onUpdateTask}
                onUpdateTasksList={p.onUpdateTasksList}
                onGubbyMessage={p.onGubbyMessage}
                manualEvents={p.manualEvents}
                onDeleteManualEvent={p.onDeleteManualEvent}
              />
            )}

            {p.activeTab === "habits" && (
              <HabitTrackerModule
                habits={p.habits}
                habitLog={p.habitLog}
                onAddHabit={p.onAddHabit}
                onDeleteHabit={p.onDeleteHabit}
                onToggleDay={p.onToggleHabitDay}
                onGubbyMessage={p.onGubbyMessage}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
}

const ModuleRouter = memo(ModuleRouterImpl);
export default ModuleRouter;

/** Map of tab id → dynamic import, used to prefetch a module on hover. */
export const MODULE_PREFETCH: Record<string, () => Promise<unknown>> = {
  compiler: () => import("../CompilerModule"),
  todo: () => import("../MagicTodoModule"),
  taskmaster: () => import("../TaskmasterModule"),
  calendar: () => import("../CalendarModule"),
  weekly: () => import("../WeeklyPlannerModule"),
  habits: () => import("../HabitTrackerModule"),
};
