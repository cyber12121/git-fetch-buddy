import React, { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, CheckCircle, Volume2, VolumeX, Plus, Award, Flame, Settings as SettingsIcon, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import BreathingOverlay from "./BreathingOverlay";
import {
  appendSession,
  computeStats,
  loadHistory,
  type SessionRecord,
} from "../lib/focusHistory";
import {
  getTodayCompletions,
  logCompletion,
  subscribeCompletionLog,
} from "../lib/completionLog";
import {
  BODY_FONT,
  DEFAULT_SETTINGS,
  MONO_FONT,
  SETTINGS_KEY,
  formatTime,
  formatFocusDuration,
  getTodayKey,
  loadSettings,
  type DurationSettings,
  type PendingAction,
  type TimerMode,
} from "./taskmaster/constants";
import { useFocusAudio } from "./taskmaster/useFocusAudio";
import PendingActionModal from "./taskmaster/PendingActionModal";
import SettingsModal from "./taskmaster/SettingsModal";
import DurationAdjuster from "./taskmaster/DurationAdjuster";
import ModeTabs from "./taskmaster/ModeTabs";
import HistoryPanel from "./taskmaster/HistoryPanel";
import SummaryView from "./taskmaster/SummaryView";
import QuestPicker from "./taskmaster/QuestPicker";
import FullscreenTimer from "./taskmaster/FullscreenTimer";

interface TaskmasterModuleProps {
  activeTaskTitle: string | null;
  activeTaskId?: string | null;
  activeSubtaskId?: string | null;
  tasks: Task[];
  onCompleteActiveTask: (taskId: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

export default function TaskmasterModule({
  activeTaskTitle,
  activeTaskId,
  activeSubtaskId,
  tasks,
  onCompleteActiveTask,
  onGubbyMessage
}: TaskmasterModuleProps) {
  const [settings, setSettings] = useState<DurationSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const POMODORO_FOCUS_SECS = settings.pomoFocusMinutes * 60;
  const POMODORO_BREAK_SECS = settings.pomoBreakMinutes * 60;
  const BREAK_SECS = settings.breakMinutes * 60;

  // Persisted session shape: `{ endAt, duration, mission, mode, pomoPhase }`.
  // Storing the absolute end timestamp (not "seconds remaining") means a
  // browser reload mid-focus resumes at the true remaining time instead of
  // rewinding to the moment we last serialized.
  const SESSION_KEY = "goblin_active_session_v1";
  type PersistedSession = {
    endAt: number;
    duration: number;
    mission?: string;
    mode?: TimerMode;
    pomoPhase?: "focus" | "break";
  };
  const loadPersistedSession = (): PersistedSession | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSession;
      if (typeof parsed?.endAt !== "number" || typeof parsed?.duration !== "number") return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const initialSession = loadPersistedSession();
  const initialRemaining = initialSession
    ? Math.max(0, Math.round((initialSession.endAt - Date.now()) / 1000))
    : 0;
  const shouldResume = !!initialSession && initialRemaining > 0;

  const [duration, setDuration] = useState(() =>
    shouldResume ? initialSession!.duration : loadSettings().focusMinutes * 60,
  );
  const [timeLeft, setTimeLeft] = useState(() =>
    shouldResume ? initialRemaining : loadSettings().focusMinutes * 60,
  );
  const [isRunning, setIsRunning] = useState(shouldResume);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pacingEnabled, setPacingEnabled] = useState(false);
  const [tempFocusTitle, setTempFocusTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [mode, setMode] = useState<TimerMode>("focus");
  const [pomoPhase, setPomoPhase] = useState<"focus" | "break">("focus");
  const [pomoRound, setPomoRound] = useState(1);
  const [sessionGen, setSessionGen] = useState(0);
  const [showBreathing, setShowBreathing] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stats = useMemo(() => computeStats(history), [history]);

  const { playChime, playTickSound } = useFocusAudio(soundEnabled);

  const [sessionFocusSeconds, setSessionFocusSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const key = `goblin_focus_seconds_${getTodayKey()}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) return parsed;
    }
    const legacy = localStorage.getItem("goblin_session_seconds");
    if (legacy !== null) {
      const parsed = parseInt(legacy, 10);
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) return parsed;
    }
    return 0;
  });

  // Recap "cleared today" is sourced from the shared completion log so it
  // reflects tasks completed via checkbox, timer, or ad-hoc missions —
  // and survives "Sweep done" (which deletes rows from tasks[]).
  const [completedMissions, setCompletedMissions] = useState<string[]>(() =>
    getTodayCompletions().map((e) => e.title),
  );
  useEffect(() => {
    return subscribeCompletionLog(() => {
      setCompletedMissions(getTodayCompletions().map((e) => e.title));
    });
  }, []);

  const [showSummary, setShowSummary] = useState(false);
  const [activeSessionSeconds, setActiveSessionSeconds] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem(`goblin_focus_seconds_${getTodayKey()}`, sessionFocusSeconds.toString());
  }, [sessionFocusSeconds]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (!isRunning) {
      const nextDur =
        mode === "break"
          ? settings.breakMinutes * 60
          : mode === "pomodoro"
          ? (pomoPhase === "break" ? settings.pomoBreakMinutes : settings.pomoFocusMinutes) * 60
          : settings.focusMinutes * 60;
      if (timeLeft === duration) {
        setDuration(nextDur);
        setTimeLeft(nextDur);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pacingEnabledRef = useRef(pacingEnabled);
  const onGubbyMessageRef = useRef(onGubbyMessage);
  const handleTimerCompleteRef = useRef<() => void>(() => {});
  const playTickSoundRef = useRef(playTickSound);

  const [currentMission, setCurrentMission] = useState(activeTaskTitle || "");
  const lastLoadedTaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTaskTitle) {
      lastLoadedTaskRef.current = null;
      return;
    }
    if (activeTaskTitle !== lastLoadedTaskRef.current) {
      lastLoadedTaskRef.current = activeTaskTitle;
      setCurrentMission(activeTaskTitle);

      // Only sync the timer duration from the task's estimate when we're in
      // FOCUS mode. Pomodoro rounds and Break intervals keep their own
      // configured lengths regardless of which task is loaded.
      if (mode !== "focus") {
        onGubbyMessage(`Mission Loaded: "${activeTaskTitle}". 🦉`, "focused");
        return;
      }

      let matchingMinutes = 25;
      const parentTitle = activeTaskTitle.includes(" ➔ ")
        ? activeTaskTitle.split(" ➔ ")[0].trim()
        : activeTaskTitle.trim();

      const matchedTask = tasks.find(t => t.title.trim().toLowerCase() === parentTitle.toLowerCase());
      if (matchedTask) {
        matchingMinutes = matchedTask.estimatedMinutes !== undefined ? matchedTask.estimatedMinutes : 25;
      }

      const newDurationSeconds = matchingMinutes * 60;
      setDuration(newDurationSeconds);
      setTimeLeft(newDurationSeconds);
      setIsRunning(false);
      setActiveSessionSeconds(0);

      const h = Math.floor(matchingMinutes / 60);
      const m = matchingMinutes % 60;
      const estimateText = h > 0 ? `${h}h ${m}m` : `${matchingMinutes}m`;
      onGubbyMessage(`Mission Loaded: "${activeTaskTitle}". Automatically adjusted timer to ${estimateText}! ⏱️🦉`, "focused");
    }
  }, [activeTaskTitle, tasks, mode, onGubbyMessage]);

  useEffect(() => {
    if (!isRunning) {
      // Session stopped/paused/completed — drop the persisted anchor so a
      // reload doesn't spuriously resume.
      try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      return;
    }

    const endAt = Date.now() + timeLeft * 1000;
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ endAt, duration, mission: currentMission, mode, pomoPhase } satisfies PersistedSession),
      );
    } catch { /* quota / SSR — best-effort */ }

    let activeElapsed = activeSessionSeconds;

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));

      setTimeLeft(remaining);
      activeElapsed += 1;
      setActiveSessionSeconds(activeElapsed);

      if (activeElapsed === 600) {
        setSessionFocusSeconds((s) => s + 600);
        onGubbyMessageRef.current("Incredible focus! You've crossed the 10-minute threshold! Your session is now officially counted. 🦉🔥", "excited");
      } else if (activeElapsed > 600) {
        setSessionFocusSeconds((s) => s + 1);
      }

      if (pacingEnabledRef.current && activeElapsed % 2 === 0) {
        playTickSoundRef.current();
      }

      // Live growth signal for the focus-plant on the side rail.
      try {
        window.dispatchEvent(
          new CustomEvent("momentum:focus-tick", { detail: { seconds: activeElapsed } }),
        );
      } catch { /* SSR / no-window */ }

      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
        handleTimerCompleteRef.current();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, sessionGen]);

  const handleStartPause = () => {
    if (!currentMission) {
      onGubbyMessage("Wait! You must type or pick a mission to focus on first!", "thoughtful");
      return;
    }
    const nextState = !isRunning;

    // On Start in FOCUS mode, snap the timer to the selected task's estimate
    // so it shows the right duration immediately (only when timer isn't
    // already mid-session).
    if (nextState && mode === "focus" && timeLeft === duration) {
      const parentTitle = currentMission.includes(" ➔ ")
        ? currentMission.split(" ➔ ")[0].trim()
        : currentMission.trim();
      const matchedTask = tasks.find(
        t => t.title.trim().toLowerCase() === parentTitle.toLowerCase()
      );
      const taskMinutes = matchedTask?.estimatedMinutes;
      if (taskMinutes && taskMinutes > 0) {
        const secs = taskMinutes * 60;
        if (secs !== duration) {
          setDuration(secs);
          setTimeLeft(secs);
        }
      }
    }

    setIsRunning(nextState);
    playChime(nextState ? "start" : "pause");
    if (nextState) {
      onGubbyMessage("Focus state active. One single thing at a time. You can do this!", "focused");
    } else {
      onGubbyMessage("Paused! Take a deep breath, roll your shoulders. Sprig is waiting here.", "cozy");
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(duration);
    setActiveSessionSeconds(0);
    onGubbyMessage("Timer reset! Ready when you are.", "cozy");
  };

  const logSession = (logMode: SessionRecord["mode"], title: string, seconds: number) => {
    if (seconds < 5) return;
    const next = appendSession({ mode: logMode, title, seconds });
    setHistory(next);
  };

  const switchMode = (next: TimerMode) => {
    if (isRunning) setIsRunning(false);
    setMode(next);
    setPomoPhase("focus");
    setPomoRound(1);
    let dur = next === "break" ? BREAK_SECS : next === "pomodoro" ? POMODORO_FOCUS_SECS : settings.focusMinutes * 60;
    if (next === "focus") {
      let matched = activeTaskId ? tasks.find((x) => x.id === activeTaskId) : undefined;
      if (!matched && activeTaskTitle) {
        const parentTitle = activeTaskTitle.includes(" ➔ ")
          ? activeTaskTitle.split(" ➔ ")[0].trim()
          : activeTaskTitle.trim();
        matched = tasks.find((x) => x.title.trim().toLowerCase() === parentTitle.toLowerCase());
      }
      const mins = matched?.estimatedMinutes;
      if (typeof mins === "number" && mins > 0) dur = mins * 60;
    }
    setDuration(dur);
    setTimeLeft(dur);
    setActiveSessionSeconds(0);
    if (next === "break") {
      setCurrentMission("Short break");
      onGubbyMessage("Break time! Stretch, hydrate, unclench that jaw. 🫖", "cozy");
    } else if (next === "pomodoro") {
      onGubbyMessage("Pomodoro loaded: 25 focus / 5 break. Pick your mission! 🍅", "focused");
    } else {
      onGubbyMessage("Back to classic focus mode. Set your one thing.", "focused");
    }
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    playChime("victory");
    const elapsed = duration;
    const missionTitle = currentMission || (mode === "break" ? "Short break" : mode === "pomodoro" ? `Pomodoro round ${pomoRound}` : "Focus session");

    if (mode === "break") {
      logSession("break", missionTitle, elapsed);
      onGubbyMessage("Break over — welcome back. Ready for another round?", "happy");
      setCurrentMission("");
      setActiveSessionSeconds(0);
      return;
    }

    if (mode === "pomodoro") {
      if (pomoPhase === "focus") {
        logSession("pomodoro", missionTitle, elapsed);
        onGubbyMessage(`Pomodoro round ${pomoRound} done! 5-min break starting. 🍅`, "happy");
        setPomoPhase("break");
        setDuration(POMODORO_BREAK_SECS);
        setTimeLeft(POMODORO_BREAK_SECS);
        setActiveSessionSeconds(0);
        setIsRunning(true);
        setSessionGen((g) => g + 1);
      } else {
        logSession("break", "Pomodoro break", elapsed);
        onGubbyMessage("Break done — back to focus! 🔥", "excited");
        setPomoPhase("focus");
        setPomoRound((r) => r + 1);
        setDuration(POMODORO_FOCUS_SECS);
        setTimeLeft(POMODORO_FOCUS_SECS);
        setActiveSessionSeconds(0);
        setIsRunning(true);
        setSessionGen((g) => g + 1);
      }
      return;
    }

    onGubbyMessage("TIME IS UP! Absolute stellar work! Celebrate taking action! 🎉", "excited");
    if (currentMission) {
      logSession("focus", currentMission, elapsed);
      if (activeTaskId) {
        onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
      } else {
        // Ad-hoc mission (no linked task) — record it in the shared log
        // so today's Recap still credits it.
        logCompletion({ id: `mission-${Date.now()}`, title: currentMission, source: "mission" });
      }
      setCurrentMission("");
      setTempFocusTitle("");
    }
    setActiveSessionSeconds(0);
  };

  // Keep interval-body refs pointed at the latest identities.
  pacingEnabledRef.current = pacingEnabled;
  onGubbyMessageRef.current = onGubbyMessage;
  handleTimerCompleteRef.current = handleTimerComplete;
  playTickSoundRef.current = playTickSound;

  const executeAction = (action: PendingAction) => {
    const title = action.value;
    setCurrentMission(title);
    setTimeLeft(duration);
    setIsRunning(false);
    setActiveSessionSeconds(0);
    if (action.type === "quest") {
      onGubbyMessage(`Loaded task: "${title}". Let's crush this!`, "focused");
    } else {
      onGubbyMessage(`Loaded quick focus mission: "${title}"! Let's conquer it!`, "focused");
    }
    setPendingAction(null);
  };

  const handleCompleteMission = () => {
    if (!currentMission) return;
    const elapsed = activeSessionSeconds;
    setIsRunning(false);
    playChime("victory");
    if (mode !== "break" && activeTaskId) {
      onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
    } else if (mode !== "break") {
      logCompletion({ id: `mission-${Date.now()}`, title: currentMission, source: "mission" });
    }
    onGubbyMessage(`Amazing! Quest "${currentMission}" completed! Victory dance! 🦖💃`, "happy");
    logSession(mode === "break" ? "break" : mode === "pomodoro" ? "pomodoro" : "focus", currentMission, elapsed);
    setCurrentMission("");
    setTempFocusTitle("");
    setActiveSessionSeconds(0);
  };

  const handleCreateTempMission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempFocusTitle.trim()) return;

    const hasProgress = timeLeft < duration && timeLeft > 0;
    if (hasProgress) {
      setPendingAction({ type: "quick_focus", value: tempFocusTitle.trim() });
      setIsRunning(false);
      onGubbyMessage("Hold on! Loading a new mission will reset your current timer's progress. Are you sure? 🦉❓", "thoughtful");
    } else {
      setCurrentMission(tempFocusTitle.trim());
      setTimeLeft(duration);
      setIsRunning(false);
      setActiveSessionSeconds(0);
      setTempFocusTitle("");
      onGubbyMessage(`Loaded quick focus mission: "${tempFocusTitle.trim()}"! Let's conquer it!`, "focused");
    }
  };

  const handleStartNewSession = () => {
    setSessionFocusSeconds(0);
    setCompletedMissions([]);
    setShowSummary(false);
    setActiveSessionSeconds(0);
    onGubbyMessage("New focus session started! Fresh energy, fresh start. Let's go! 🌟", "happy");
  };

  const handlePickTask = (title: string) => {
    const hasProgress = timeLeft < duration && timeLeft > 0;
    if (hasProgress) {
      setPendingAction({ type: "quest", value: title });
      setIsRunning(false);
    } else {
      setCurrentMission(title);
      setTimeLeft(duration);
      setIsRunning(false);
      setActiveSessionSeconds(0);
      onGubbyMessage(`Loaded task: "${title}". Let's crush this!`, "focused");
    }
  };

  if (showSummary) {
    return (
      <SummaryView
        sessionFocusSeconds={sessionFocusSeconds}
        completedMissions={completedMissions}
        onBack={() => setShowSummary(false)}
        onResetDay={handleStartNewSession}
      />
    );
  }

  const remainingRatio = duration > 0 ? timeLeft / duration : 1;
  const donePct = Math.round((1 - remainingRatio) * 100);
  const zone = remainingRatio <= 0.1 ? "danger" : remainingRatio <= 0.2 ? "warn" : "brand";
  const zoneColor = zone === "danger" ? "var(--color-danger)" : zone === "warn" ? "var(--color-warn)" : "var(--color-brand)";
  const status = isRunning ? "focusing" : timeLeft === duration ? "ready" : "paused";
  const openTasks = tasks.filter(t => !t.completed);

  return (
    <div id="taskmaster-module" className="max-w-xl mx-auto px-1 sm:px-0 pb-10 space-y-4" style={{ fontFamily: BODY_FONT }}>
      <AnimatePresence>
        {pendingAction && (
          <PendingActionModal
            pendingAction={pendingAction}
            onConfirm={executeAction}
            onCancel={() => setPendingAction(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBreathing && (
          <BreathingOverlay
            monoFont={MONO_FONT}
            onClose={() => setShowBreathing(false)}
            onComplete={(secs) => {
              logSession("breathe", "4-2-6 breathing", secs);
              setShowBreathing(false);
              onGubbyMessage("Breathing complete. Nervous system, downshifted. 🌬️", "cozy");
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            settings={settings}
            onChange={setSettings}
            onClose={() => setShowSettings(false)}
            onReset={() => setSettings(DEFAULT_SETTINGS)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullscreen && (
          <FullscreenTimer
            timeLeft={timeLeft}
            isRunning={isRunning}
            onToggle={handleStartPause}
            onReset={handleReset}
            onClose={() => setIsFullscreen(false)}
          />
        )}
      </AnimatePresence>

      <section className="rounded-3xl border border-edge bg-surface card-shadow p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted min-w-0 truncate"
            style={{ fontFamily: MONO_FONT }}
          >
            <span
              className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                isRunning ? "bg-success animate-pulse" : status === "paused" ? "bg-warn" : "bg-ink-muted/50"
              }`}
            />
            {mode === "pomodoro" ? `pomo r${pomoRound} · ${pomoPhase}` : mode} · {status}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              id="timer-view-summary-btn"
              onClick={() => { setIsRunning(false); setShowSummary(true); }}
              className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer transition-colors"
              style={{ fontFamily: MONO_FONT }}
            >
              <Award size={12} /> Recap
            </button>
            <button
              id="timer-fullscreen-btn"
              onClick={() => setIsFullscreen(true)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer transition-colors"
              aria-label="Enter fullscreen timer"
              title="Fullscreen"
            >
              <Maximize2 size={13} />
            </button>
            <button
              id="timer-settings-btn"
              onClick={() => setShowSettings(true)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer transition-colors"
              aria-label="Timer settings"
              title="Timer settings"
            >
              <SettingsIcon size={13} />
            </button>
          </div>
        </div>

        <ModeTabs mode={mode} onSwitchMode={switchMode} onBreathe={() => setShowBreathing(true)} />

        <div className="text-center min-h-[3rem] mb-5">
          <AnimatePresence mode="wait">
            {currentMission ? (
              <motion.h2
                key={currentMission}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-lg sm:text-xl font-semibold text-ink leading-snug break-words"
              >
                {currentMission}
              </motion.h2>
            ) : (
              <motion.form
                key="quick"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleCreateTempMission}
                className="flex items-center gap-2 max-w-md mx-auto"
              >
                <input
                  id="quick-focus-input"
                  type="text"
                  value={tempFocusTitle}
                  onChange={(e) => setTempFocusTitle(e.target.value)}
                  placeholder="One thing. What is it?"
                  className="flex-1 min-w-0 bg-transparent border-b border-edge focus:border-brand outline-none text-center text-base font-semibold text-ink placeholder:text-ink-muted/50 py-2 transition-colors"
                />
                {tempFocusTitle.trim() && (
                  <button
                    id="load-quick-focus-btn"
                    type="submit"
                    aria-label="Set mission"
                    className="shrink-0 p-2 text-brand hover:text-brand-hover cursor-pointer"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mb-4">
          <div
            role="timer"
            aria-live="polite"
            aria-label={`${formatTime(timeLeft)} remaining, ${status}`}
            className="font-bold tabular-nums leading-none tracking-tight select-none transition-colors duration-700"
            style={{
              fontFamily: MONO_FONT,
              fontSize: "clamp(3rem, 13vw, 6.5rem)",
              color: zoneColor,
              textShadow: isRunning ? `0 0 40px ${zoneColor}33` : "none",
              letterSpacing: "-0.03em",
            }}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="h-[3px] w-full bg-surface-sunken relative overflow-hidden rounded-full mb-6">
          <motion.div
            className="h-full absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: zoneColor, boxShadow: `0 0 10px ${zoneColor}` }}
            animate={{ width: `${donePct}%` }}
            transition={{ duration: 0.6, ease: "linear" }}
          />
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            id="timer-reset-btn"
            onClick={handleReset}
            className="h-12 w-12 flex items-center justify-center bg-transparent hover:bg-surface-sunken border border-edge rounded-full text-ink-muted transition-colors cursor-pointer"
            title="Reset"
            aria-label="Reset timer"
          >
            <RotateCcw size={15} />
          </button>

          <button
            id="timer-play-pause-btn"
            onClick={handleStartPause}
            aria-label={isRunning ? "Pause" : "Start"}
            className={`h-16 w-16 flex items-center justify-center rounded-full text-primary-foreground transition-all active:scale-95 cursor-pointer ${
              isRunning ? "bg-warn hover:opacity-90" : "bg-brand hover:bg-brand-hover"
            }`}
            style={{ boxShadow: isRunning ? "none" : "var(--theme-glow)" }}
          >
            {isRunning ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current ml-0.5" />}
          </button>

          {currentMission ? (
            <button
              id="timer-complete-btn"
              onClick={handleCompleteMission}
              className="h-12 w-12 flex items-center justify-center bg-transparent hover:bg-success-soft border border-success/40 rounded-full text-success transition-colors cursor-pointer"
              title="Finish mission"
              aria-label="Mark mission complete"
            >
              <CheckCircle size={15} />
            </button>
          ) : (
            <div className="h-12 w-12" aria-hidden="true" />
          )}
        </div>

        {/* One consistent control strip: length, progress, sound, pacing. */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-4 border-t border-edge text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted"
          style={{ fontFamily: MONO_FONT }}
        >
          {!isRunning && status !== "paused" ? (
            <DurationAdjuster mode={mode} pomoPhase={pomoPhase} settings={settings} onChange={setSettings} />
          ) : (
            <span>{Math.floor(duration / 60)}m goal</span>
          )}
          <span className="text-ink-muted/40" aria-hidden="true">·</span>
          <span className="tabular-nums">{donePct}%</span>
          <span className="text-ink-muted/40" aria-hidden="true">·</span>
          <button
            id="sound-fx-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Mute chimes" : "Enable chimes"}
            className={`inline-flex items-center gap-1 hover:text-ink transition-colors cursor-pointer ${soundEnabled ? "text-brand" : ""}`}
          >
            {soundEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
            <span>sound</span>
          </button>
          <span className="text-ink-muted/40" aria-hidden="true">·</span>
          <button
            id="body-double-pacing-toggle"
            onClick={() => setPacingEnabled(!pacingEnabled)}
            aria-label={pacingEnabled ? "Turn off body-double tick" : "Turn on body-double tick"}
            className={`inline-flex items-center hover:text-ink transition-colors cursor-pointer ${pacingEnabled ? "text-brand" : ""}`}
          >
            tick
          </button>
        </div>

        {activeSessionSeconds > 0 && (
          <p
            className={`mt-3 text-center text-[10px] font-bold tracking-[0.18em] uppercase ${
              activeSessionSeconds >= 600 ? "text-success" : "text-brand"
            }`}
            style={{ fontFamily: MONO_FONT }}
          >
            {activeSessionSeconds >= 600
              ? "this run is counted"
              : `run ${Math.floor(activeSessionSeconds / 60)}m ${activeSessionSeconds % 60}s / 10m to count`}
          </p>
        )}
      </section>

      {!currentMission && <QuestPicker openTasks={openTasks} onPick={handlePickTask} />}

      <HistoryPanel
        stats={stats}
        history={history}
        showHistory={showHistory}
        cleared={completedMissions.length}
        onToggle={() => setShowHistory((v) => !v)}
      />
    </div>
  );
}
