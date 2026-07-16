import { useCallback, useEffect, useState } from "react";
import GubbyCompanion from "./components/GubbyCompanion";
import AppNav from "./components/AppNav";
import SideNav from "./components/SideNav";
import AppStatusBar from "./components/AppStatusBar";

import ModuleRouter, { MODULE_PREFETCH, type TabId } from "./components/app/ModuleRouter";
import RightAside from "./components/app/RightAside";

import { useToast } from "./components/Toast";
import { useCloudSync } from "./hooks/useCloudSync";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";
import { useHashRouting } from "./hooks/useHashRouting";
import { useAppData } from "./hooks/useAppData";
import { useXpSystem } from "./hooks/useXpSystem";
import { useGubbyState } from "./hooks/useGubbyState";
import { useTaskHandlers } from "./hooks/useTaskHandlers";
import { toLocalDateKey } from "./lib/constants";
import { applyTheme, readStoredTheme, subscribeTheme, type ThemeId } from "./lib/themes";

// Valid tab ids, single source of truth for hash-routing + typing.
const VALID_TABS: readonly TabId[] = ["compiler", "todo", "taskmaster", "calendar", "weekly", "habits"];

/**
 * Root application shell.
 *
 * Responsibilities are delegated to focused hooks and memoized components:
 *   - useHashRouting  → tab state + deep-linking + focus mgmt
 *   - useAppData      → tasks/events/habits + persisted setters
 *   - useXpSystem     → XP, combo, milestone/level-up feedback
 *   - useGubbyState   → Sprig message/mood/hidden preference
 *   - useTaskHandlers → all task/event/habit mutations (stable callbacks)
 *   - useGoogleCalendar / useCloudSync → external integrations
 *   - <ModuleRouter/> → lazy-loads and renders the active workspace module
 */
export default function App() {
  const { pushToast } = useToast();

  // ── Theme ────────────────────────────────────────────────────────────
  const [themeId, setThemeId] = useState<ThemeId>("cozy-goblin");
  useEffect(() => {
    const t = readStoredTheme();
    applyTheme(t);
    setThemeId(t);
    return subscribeTheme(setThemeId);
  }, []);
  const showGubby = themeId !== "kinetic-dark";

  // ── Routing ──────────────────────────────────────────────────────────
  const { activeTab, setActiveTab, mainRef } = useHashRouting<TabId>(VALID_TABS, "todo");

  // ── Persisted data + Sprig state ─────────────────────────────────────
  const data = useAppData({ pushToast });
  const gubby = useGubbyState();

  // ── XP / combo / level-up ────────────────────────────────────────────
  const { xp, setXp, addXp, registerCombo } = useXpSystem({
    pushToast,
    onLevelUp: gubby.triggerGubbySpeak,
  });

  // ── Selected date + Taskmaster focus pointer ─────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateKey());
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);

  // ── Auth + Google Calendar ───────────────────────────────────────────
  const {
    user, accessToken, googleEvents, isLoadingGoogle, googleError,
    setIsLoadingGoogle, loadGoogleEvents,
    handleConnectGoogle, handleDisconnectGoogle, handleSignOut,
  } = useGoogleCalendar({
    selectedDate,
    onMessage: gubby.triggerGubbySpeak,
    setManualEvents: data.setManualEvents,
  });

  // ── Cloud sync ───────────────────────────────────────────────────────
  const { cloudStatus } = useCloudSync({
    user,
    tasks: data.tasks,
    manualEvents: data.manualEvents,
    habits: data.habits,
    habitLog: data.habitLog,
    syncTasks: data.syncTasks,
    syncEvents: data.syncEvents,
    syncHabits: data.syncHabits,
    syncHabitLog: data.syncHabitLog,
    setXp,
    pushToast,
  });

  // ── Task / event / habit handlers ────────────────────────────────────
  const handlers = useTaskHandlers({
    tasks: data.tasks,
    syncTasks: data.syncTasks,
    manualEvents: data.manualEvents,
    syncEvents: data.syncEvents,
    habits: data.habits,
    syncHabits: data.syncHabits,
    habitLog: data.habitLog,
    syncHabitLog: data.syncHabitLog,
    accessToken,
    setIsLoadingGoogle,
    loadGoogleEvents,
    addXp,
    registerCombo,
    pushToast,
    setGubbyMood: gubby.setGubbyMood,
    setGubbyMessage: gubby.setGubbyMessage,
    setActiveTab,
    setActiveTaskTitle,
    setActiveTaskId,
    setActiveSubtaskId,
  });

  const handlePrefetchTab = useCallback((tab: string) => {
    MODULE_PREFETCH[tab]?.().catch(() => {});
  }, []);
  const hideGubby = useCallback(() => gubby.updateGubbyHidden(true), [gubby]);
  const showGubbyAgain = useCallback(() => gubby.updateGubbyHidden(false), [gubby]);

  // ── Layout decisions ─────────────────────────────────────────────────
  const isWide = activeTab === "weekly" || activeTab === "calendar" || activeTab === "habits";
  const rootBgClass = activeTab === "weekly" || activeTab === "calendar"
    ? "bg-canvas text-ink pb-20 md:pb-0"
    : "bg-canvas text-ink-2 pb-24 md:pb-16";
  const containerClass = isWide
    ? (activeTab === "weekly" ? "p-0" : "max-w-[1400px] mx-auto px-4 mt-6")
    : "max-w-[1400px] mx-auto px-4 mt-6";
  const gridClass = isWide
    ? "block"
    : "lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_20rem] lg:gap-6 lg:items-start";

  return (
    <div
      id="goblin-flow-root"
      className={`min-h-dvh flex flex-col font-sans antialiased transition-colors duration-150 ${rootBgClass}`}
    >
      <AppNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabId)}
        onGubbyMessage={gubby.triggerGubbySpeak}
        onPrefetchTab={handlePrefetchTab}
        xp={xp}
      />

      <div className={`flex-1 w-full ${containerClass}`}>
        <div className={gridClass}>
          {/* LEFT: sidebar (desktop, do-tabs only) */}
          {!isWide && (
            <SideNav
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as TabId)}
              onGubbyMessage={gubby.triggerGubbySpeak}
              onPrefetchTab={handlePrefetchTab}
              taskCount={data.tasks.filter((t) => !t.completed).length}
            />
          )}

          {/* CENTER: active module */}
          <main
            ref={mainRef}
            id="tabpanel-main"
            tabIndex={-1}
            aria-live="polite"
            className={`min-w-0 outline-none scroll-mt-24 ${isWide ? "w-full" : ""}`}
          >
            <ModuleRouter
              activeTab={activeTab}
              tasks={data.tasks}
              manualEvents={data.manualEvents}
              habits={data.habits}
              habitLog={data.habitLog}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              activeTaskTitle={activeTaskTitle}
              activeTaskId={activeTaskId}
              activeSubtaskId={activeSubtaskId}
              googleEvents={googleEvents}
              isLoadingGoogle={isLoadingGoogle}
              googleError={googleError}
              user={user}
              accessToken={accessToken}
              onConnectGoogle={handleConnectGoogle}
              onDisconnectGoogle={handleDisconnectGoogle}
              onSignOut={handleSignOut}
              onLoadGoogleEvents={loadGoogleEvents}
              onGubbyMessage={gubby.triggerGubbySpeak}
              onGainXp={addXp}
              onAddTask={handlers.handleAddTask}
              onDeleteTask={handlers.handleDeleteTask}
              onToggleTask={handlers.handleToggleTask}
              onUpdateTask={handlers.handleUpdateTask}
              onUpdateTasksList={data.syncTasks}
              onFocusTask={handlers.handleFocusTask}
              onCompleteActiveTask={handlers.handleCompleteActiveTask}
              onTasksCompiled={handlers.handleTasksCompiled}
              onAddManualEvent={handlers.handleAddManualEvent}
              onDeleteManualEvent={handlers.handleDeleteManualEvent}
              onAddHabit={handlers.handleAddHabit}
              onDeleteHabit={handlers.handleDeleteHabit}
              onToggleHabitDay={handlers.handleToggleHabitDay}
            />
          </main>

          {/* RIGHT: Sprig + Today's Quests + rewards (desktop, do-tabs only) */}
          {!isWide && (
            <RightAside
              tasks={data.tasks}
              onToggleTask={handlers.handleToggleTask}
              showGubby={showGubby}
              gubbyHidden={gubby.gubbyHidden}
              gubbyMood={gubby.gubbyMood}
              gubbyMessage={gubby.gubbyMessage}
              xp={xp}
              onHideGubby={hideGubby}
              onShowGubby={showGubbyAgain}
            />
          )}
        </div>

        {/* Mobile/tablet: inline Sprig below the module. Rewards live in Settings. */}
        <section aria-label="Extras" className="lg:hidden mt-6 space-y-4">
          {showGubby && !isWide && !gubby.gubbyHidden && (
            <GubbyCompanion
              mood={gubby.gubbyMood}
              customMessage={gubby.gubbyMessage}
              xp={xp}
              onHide={hideGubby}
            />
          )}
        </section>
      </div>

      {activeTab !== "weekly" && <AppStatusBar user={user} cloudStatus={cloudStatus} />}
    </div>
  );
}
