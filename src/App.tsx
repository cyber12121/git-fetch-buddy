import { useCallback, useEffect, useRef, useState } from "react";
import GubbyCompanion from "./components/GubbyCompanion";
import AppNav from "./components/AppNav";
import SideNav from "./components/SideNav";
import AppStatusBar from "./components/AppStatusBar";

import ModuleRouter, { MODULE_PREFETCH, type TabId } from "./components/app/ModuleRouter";
import RightAside from "./components/app/RightAside";
import FocusPlant from "./components/FocusPlant";

import { useToast } from "./components/Toast";
import { useCloudSync } from "./hooks/useCloudSync";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";
import { useAppData } from "./hooks/useAppData";
import { useXpSystem } from "./hooks/useXpSystem";
import { useGubbyState } from "./hooks/useGubbyState";
import { useTaskHandlers } from "./hooks/useTaskHandlers";
import { toLocalDateKey } from "./lib/constants";
import { applyTheme, readStoredTheme, subscribeTheme, type ThemeId } from "./lib/themes";

interface AppProps {
  /** Which tab is active — driven by the route (`/today`, `/compiler`, …). */
  activeTab: TabId;
  /** Router-backed navigation. Every tab click is a real URL change now. */
  onNavigate: (tab: TabId) => void;
}

/**
 * Root application shell.
 *
 * Tab routing used to live in a `useHashRouting` hook that pushed `#today`,
 * `#compiler` etc. onto `window.location.hash`. That worked in a single
 * `/` route but broke deep-link SEO, back button, and shareable URLs. The
 * router now owns tab identity via `/$tab` — App just receives `activeTab`
 * and `onNavigate` from the route component.
 */
export default function App({ activeTab, onNavigate }: AppProps) {
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
  const mainRef = useRef<HTMLElement | null>(null);
  const setActiveTab = onNavigate;
  // Focus the freshly-mounted <main> after tab changes so keyboard users
  // land inside the new module. Skip the very first mount to avoid a
  // page-load focus jump.
  const firstMountRef = useRef(true);
  useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = mainRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab]);

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
    xp,
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
              onOpenTab={(tab) => setActiveTab(tab as TabId)}
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
              activeTab={activeTab}
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
          {activeTab === "taskmaster" && <FocusPlant compact />}
        </section>
      </div>

      {activeTab !== "weekly" && <AppStatusBar user={user} cloudStatus={cloudStatus} />}
    </div>
  );
}
