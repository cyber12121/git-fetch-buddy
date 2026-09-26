import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Volume2,
  VolumeX,
  Plus,
  Award,
  Settings as SettingsIcon,
  Maximize2,
  Sparkles,
  Coffee,
  Wind,
  Bell,
  Leaf,
  Flame,
  CloudRain,
  Waves,
  Check,
  ChevronDown,
  ListTodo,
  Zap,
  Headphones,
} from "lucide-react";
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
  getTodayKey,
  loadSettings,
  type DurationSettings,
  type PendingAction,
  type TimerMode,
} from "./taskmaster/constants";
import { useFocusAudio, type SoundscapeType } from "./taskmaster/useFocusAudio";
import PendingActionModal from "./taskmaster/PendingActionModal";
import SettingsModal from "./taskmaster/SettingsModal";
import SummaryView from "./taskmaster/SummaryView";
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
  onGubbyMessage,
}: TaskmasterModuleProps) {
  const [settings, setSettings] = useState<DurationSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);

  const SESSION_KEY = "goblin_active_session_v1";
  type PersistedSession = {
    endAt: number;
    duration: number;
    mission?: string;
    mode?: TimerMode;
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
    shouldResume ? initialSession!.duration : loadSettings().focusMinutes * 60
  );
  const [timeLeft, setTimeLeft] = useState(() =>
    shouldResume ? initialRemaining : loadSettings().focusMinutes * 60
  );
  const [isRunning, setIsRunning] = useState(shouldResume);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pacingEnabled, setPacingEnabled] = useState(false);
  const [tempFocusTitle, setTempFocusTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [mode, setMode] = useState<TimerMode>("focus");
  const [sessionGen, setSessionGen] = useState(0);
  const [showBreathing, setShowBreathing] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stats = useMemo(() => computeStats(history), [history]);

  // Pomodoro 4-Stage Loop (1 -> 2 -> 3 -> 4 -> repeat)
  const POMO_ROUND_KEY = "goblin_pomo_round";
  const [pomoRound, setPomoRound] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(POMO_ROUND_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 4) return parsed;
    }
    return 1;
  });

  useEffect(() => {
    localStorage.setItem(POMO_ROUND_KEY, pomoRound.toString());
  }, [pomoRound]);

  const rideFlow = () => {
    const bonus = 10 * 60; // +10 minutes
    setDuration((prev) => prev + bonus);
    setTimeLeft((prev) => prev + bonus);
    onGubbyMessage("Riding the flow! +10 minutes added seamlessly. ⚡ Keep your rhythm.", "focused");
  };

  // Audio Engine: Chimes, Tick, Tibetan Bell & Ambient Soundscapes
  const {
    playChime,
    playTickSound,
    playTibetanBell,
    startSoundscape,
    stopSoundscape,
    setSoundscapeVolume,
  } = useFocusAudio(soundEnabled);

  // Soundscape state
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeType | null>(null);
  const [soundscapeVol, setSoundscapeVol] = useState(0.4);
  const [bellFeedback, setBellFeedback] = useState(false);

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

  const [completedMissions, setCompletedMissions] = useState<string[]>(() =>
    getTodayCompletions().map((e) => e.title)
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

      if (mode !== "focus") {
        onGubbyMessage(`Anchor Loaded: "${activeTaskTitle}". 🌿`, "focused");
        return;
      }

      let matchingMinutes = 25;
      const parentTitle = activeTaskTitle.includes(" ➔ ")
        ? activeTaskTitle.split(" ➔ ")[0].trim()
        : activeTaskTitle.trim();

      const matchedTask = tasks.find(
        (t) => t.title.trim().toLowerCase() === parentTitle.toLowerCase()
      );
      if (matchedTask && matchedTask.estimatedMinutes !== undefined) {
        matchingMinutes = matchedTask.estimatedMinutes;
      }

      const newDurationSeconds = matchingMinutes * 60;
      setDuration(newDurationSeconds);
      setTimeLeft(newDurationSeconds);
      setIsRunning(false);
      setActiveSessionSeconds(0);

      const h = Math.floor(matchingMinutes / 60);
      const m = matchingMinutes % 60;
      const estimateText = h > 0 ? `${h}h ${m}m` : `${matchingMinutes}m`;
      onGubbyMessage(`Anchor: "${activeTaskTitle}" (${estimateText}). Take your time. 🍃`, "focused");
    }
  }, [activeTaskTitle, tasks, mode, onGubbyMessage]);

  useEffect(() => {
    if (!isRunning) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const endAt = Date.now() + timeLeft * 1000;
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          endAt,
          duration,
          mission: currentMission,
          mode,
        } satisfies PersistedSession)
      );
    } catch {
      /* ignore */
    }

    let activeElapsed = activeSessionSeconds;

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));

      setTimeLeft(remaining);
      activeElapsed += 1;
      setActiveSessionSeconds(activeElapsed);

      if (activeElapsed === 600) {
        setSessionFocusSeconds((s) => s + 600);
        onGubbyMessageRef.current("10-minute focus threshold crossed! Session officially rooted. 🌿✨", "excited");
      } else if (activeElapsed > 600) {
        setSessionFocusSeconds((s) => s + 1);
      }

      if (pacingEnabledRef.current && activeElapsed % 2 === 0) {
        playTickSoundRef.current();
      }

      try {
        window.dispatchEvent(
          new CustomEvent("momentum:focus-tick", { detail: { seconds: activeElapsed } })
        );
      } catch {
        /* ignore */
      }

      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
        handleTimerCompleteRef.current();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, sessionGen]);

  const handleStartPause = () => {
    if (!currentMission && mode === "focus") {
      onGubbyMessage("Type or pick your focus anchor first before starting! 🌿", "thoughtful");
      return;
    }
    const nextState = !isRunning;

    if (nextState && mode === "focus" && timeLeft === duration) {
      const parentTitle = currentMission.includes(" ➔ ")
        ? currentMission.split(" ➔ ")[0].trim()
        : currentMission.trim();
      const matchedTask = tasks.find(
        (t) => t.title.trim().toLowerCase() === parentTitle.toLowerCase()
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
      onGubbyMessage("Sanctuary open. Breathe easy, one step at a time.", "focused");
    } else {
      onGubbyMessage("Paused softly. Take a sip of water, unclench your shoulders.", "cozy");
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(duration);
    setActiveSessionSeconds(0);
    onGubbyMessage("Timer rested. Return whenever you are ready.", "cozy");
  };

  const adjustTime = (deltaSeconds: number) => {
    setTimeLeft((prev) => {
      const next = Math.max(60, prev + deltaSeconds);
      if (!isRunning) {
        setDuration(next);
      }
      return next;
    });
    const mins = Math.abs(Math.round(deltaSeconds / 60));
    onGubbyMessage(
      deltaSeconds > 0
        ? `Added +${mins}m gentle buffer.`
        : `Reduced by -${mins}m. Light and focused.`,
      "cozy"
    );
  };

  const logSession = (logMode: SessionRecord["mode"], title: string, seconds: number) => {
    if (seconds < 5) return;
    const next = appendSession({ mode: logMode, title, seconds });
    setHistory(next);
  };

  const switchMode = (next: TimerMode) => {
    if (isRunning) setIsRunning(false);
    setMode(next);
    let dur =
      next === "break"
        ? settings.breakMinutes * 60
        : settings.focusMinutes * 60;
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
      setCurrentMission("Gentle recharge");
      onGubbyMessage("Gentle rest started. Soften your gaze, hydrate. 🫖", "cozy");
    } else {
      onGubbyMessage("Focus flow active. One gentle task at a time. 🌿", "focused");
    }
  };

  const startBreak = () => {
    setIsRunning(false);
    setMode("break");
    const isDeepRecharge = pomoRound >= 4;
    const breakDur = isDeepRecharge ? 15 * 60 : (settings.breakMinutes || 5) * 60;
    setDuration(breakDur);
    setTimeLeft(breakDur);
    setActiveSessionSeconds(0);
    setIsRunning(true);
    setSessionGen((g) => g + 1);
    onGubbyMessage(
      isDeepRecharge
        ? "Deep Recharge started! 15 minutes to fully unplug and rest your mind. 🏕️"
        : "Gentle rest started. Soften your gaze and hydrate. 🫖",
      "cozy"
    );
  };

  const endBreakToFocus = () => {
    setIsRunning(false);
    if (pomoRound >= 4) {
      setPomoRound(1);
    } else {
      setPomoRound((r) => r + 1);
    }
    setMode("focus");
    let dur = settings.focusMinutes * 60;
    if (currentMission) {
      const parentTitle = currentMission.includes(" ➔ ")
        ? currentMission.split(" ➔ ")[0].trim()
        : currentMission.trim();
      const matched = tasks.find((x) => x.title.trim().toLowerCase() === parentTitle.toLowerCase());
      if (matched?.estimatedMinutes) dur = matched.estimatedMinutes * 60;
    }
    setDuration(dur);
    setTimeLeft(dur);
    setActiveSessionSeconds(0);
    setSessionGen((g) => g + 1);
    onGubbyMessage("Back to focus flow. One gentle step at a time. 🌿", "focused");
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    playTibetanBell();
    const elapsed = duration;
    const missionTitle = currentMission || "Deep Focus";

    if (mode === "break") {
      logSession("break", missionTitle, elapsed);
      if (pomoRound >= 4) {
        setPomoRound(1);
        onGubbyMessage("Grand Pomodoro cycle complete! 🌸 Garden fully in bloom. Resetting for a fresh cycle.", "happy");
      } else {
        const nextRound = pomoRound + 1;
        setPomoRound(nextRound);
        onGubbyMessage(`Rest finished! Moving to Pomodoro Sprint ${nextRound} of 4. 🍃`, "happy");
      }
      setMode("focus");
      const nextFocusDur = (settings.focusMinutes || 25) * 60;
      setDuration(nextFocusDur);
      setTimeLeft(nextFocusDur);
      setActiveSessionSeconds(0);
      setIsRunning(false);
      setSessionGen((g) => g + 1);
      return;
    }

    // Focus session finished: log session and complete task if linked
    logSession("focus", missionTitle, elapsed);
    if (activeTaskId) {
      onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
    } else if (currentMission) {
      logCompletion({ id: `mission-${Date.now()}`, title: currentMission, source: "mission" });
    }

    const isFinalRound = pomoRound >= 4;
    const breakDur = isFinalRound ? 15 * 60 : (settings.breakMinutes || 5) * 60;

    if (isFinalRound) {
      onGubbyMessage("Cycle 4 complete! 🏆 You earned a 15-minute Deep Recharge. Rest your eyes and hydrate. 🏕️", "excited");
    } else {
      onGubbyMessage(`Sprint ${pomoRound} complete! 5-minute restorative break starting now. 🍵 Unclench your shoulders.`, "excited");
    }

    // Automatically transition to restorative break
    setMode("break");
    setDuration(breakDur);
    setTimeLeft(breakDur);
    setActiveSessionSeconds(0);
    setIsRunning(true);
    setSessionGen((g) => g + 1);
  };

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
    onGubbyMessage(`Loaded anchor: "${title}". Deep breath, let's step in. 🌿`, "focused");
    setPendingAction(null);
  };

  const handleCompleteMission = () => {
    if (!currentMission) return;
    const elapsed = activeSessionSeconds;
    setIsRunning(false);
    playTibetanBell();
    if (mode !== "break" && activeTaskId) {
      onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
    } else if (mode !== "break") {
      logCompletion({ id: `mission-${Date.now()}`, title: currentMission, source: "mission" });
    }
    onGubbyMessage(`Anchor "${currentMission}" completed with ease! Beautiful work! 🌿✨`, "happy");
    logSession(
      mode === "break" ? "break" : mode === "pomodoro" ? "pomodoro" : "focus",
      currentMission,
      elapsed
    );
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
      onGubbyMessage("Loading a new anchor will reset current timer progress. Switch now? 🦉", "thoughtful");
    } else {
      setCurrentMission(tempFocusTitle.trim());
      setTimeLeft(duration);
      setIsRunning(false);
      setActiveSessionSeconds(0);
      setTempFocusTitle("");
      onGubbyMessage(`Anchor set: "${tempFocusTitle.trim()}". Steady and calm.`, "focused");
    }
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
      onGubbyMessage(`Loaded anchor: "${title}". Steady and calm. 🍃`, "focused");
    }
  };

  const handleToggleSoundscape = (type: SoundscapeType) => {
    if (activeSoundscape === type) {
      stopSoundscape();
      setActiveSoundscape(null);
    } else {
      setActiveSoundscape(type);
      startSoundscape(type, soundscapeVol);
      if (type === "binaural_40hz") {
        onGubbyMessage(
          "Dr. Andrew Huberman 40 Hz Gamma active! 🎧 Pop on stereo headphones for dopamine & prefrontal focus.",
          "focused"
        );
      } else if (type === "binaural_10hz") {
        onGubbyMessage(
          "10 Hz Alpha waves active! 🎧 Pop on stereo headphones for calm alertness & mental relaxation.",
          "cozy"
        );
      }
    }
  };

  const handleVolumeChange = (vol: number) => {
    setSoundscapeVol(vol);
    setSoundscapeVolume(vol);
    if (!activeSoundscape && vol > 0) {
      setActiveSoundscape("rain");
      startSoundscape("rain", vol);
    }
  };

  const triggerBellTest = () => {
    playTibetanBell();
    setBellFeedback(true);
    setTimeout(() => setBellFeedback(false), 2600);
  };

  if (showSummary) {
    return (
      <SummaryView
        sessionFocusSeconds={sessionFocusSeconds}
        completedMissions={completedMissions}
        onBack={() => setShowSummary(false)}
        onResetDay={() => {
          setSessionFocusSeconds(0);
          setCompletedMissions([]);
          setShowSummary(false);
          setActiveSessionSeconds(0);
        }}
      />
    );
  }

  // Time Timer geometry & math for card dial
  const cx = 160;
  const cy = 160;
  const dialR = 112; // Dial disk radius
  const rNum = 138;  // Numbers radius

  const minutesFloat = Math.max(0, Math.min(60, timeLeft / 60));
  const angleDeg = (minutesFloat / 60) * 360;

  const wedgeColor =
    mode === "break"
      ? pomoRound >= 4
        ? "#8b5cf6"
        : "#10b981"
      : "#ef4444";

  const dialWedgePath = useMemo(() => {
    if (minutesFloat <= 0.05) return null;
    if (minutesFloat >= 59.95) return "FULL";

    const rad = (angleDeg * Math.PI) / 180;
    const startX = cx;
    const startY = cy - dialR;
    const endX = cx - dialR * Math.sin(rad);
    const endY = cy - dialR * Math.cos(rad);
    const largeArcFlag = angleDeg > 180 ? 1 : 0;

    return `M ${cx} ${cy} L ${startX} ${startY} A ${dialR} ${dialR} 0 ${largeArcFlag} 0 ${endX} ${endY} Z`;
  }, [minutesFloat, angleDeg, cx, cy, dialR]);

  // 60 radial ticks around the dial
  const ticks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      const isMajor = i % 5 === 0;
      const rad = (i * 6 * Math.PI) / 180;
      const xOuter = cx - dialR * Math.sin(rad);
      const yOuter = cy - dialR * Math.cos(rad);
      const len = isMajor ? 12 : 6;
      const xInner = cx - (dialR - len) * Math.sin(rad);
      const yInner = cy - (dialR - len) * Math.cos(rad);

      arr.push({
        i,
        isMajor,
        x1: xOuter,
        y1: yOuter,
        x2: xInner,
        y2: yInner,
        stroke: isMajor ? "#717988" : "#323841",
        strokeWidth: isMajor ? 1.8 : 1,
      });
    }
    return arr;
  }, [cx, cy, dialR]);

  // Outer numbers (0, 5, 10, ..., 55 counter-clockwise)
  const dialNumbers = useMemo(() => {
    const list = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return list.map((m) => {
      const rad = (m * 6 * Math.PI) / 180;
      const x = cx - rNum * Math.sin(rad);
      const y = cy - rNum * Math.cos(rad);
      return { m, x, y };
    });
  }, [cx, cy, rNum]);

  const openTasks = tasks.filter((t) => !t.completed);

  return (
    <div
      id="taskmaster-module"
      className="max-w-2xl mx-auto px-2 sm:px-4 pb-16 space-y-4"
      style={{ fontFamily: BODY_FONT }}
    >
      {/* Overlays */}
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
              logSession("breathe", "4-2-6 calming breath", secs);
              setShowBreathing(false);
              onGubbyMessage("Breathing complete. Centered and grounded. 🍃", "cozy");
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
            duration={duration}
            isRunning={isRunning}
            onToggle={handleStartPause}
            onReset={handleReset}
            onClose={() => setIsFullscreen(false)}
            activeTaskTitle={currentMission || activeTaskTitle || tempFocusTitle || undefined}
            pomoRound={pomoRound}
            mode={mode}
          />
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* MAIN SANCTUARY CARD: UNIFIED, CLEAN, SERENE                  */}
      {/* ============================================================ */}
      <section className="rounded-3xl border border-edge bg-surface card-shadow p-6 sm:p-8 relative overflow-hidden">
        {/* Soft background ambient warmth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-brand/5 blur-3xl"
        />

        {/* --- Top Row: Clean Phase Badge & Quiet Utilities (Option A) --- */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          {/* Automatic Phase Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border shadow-xs transition-all ${
                mode === "break"
                  ? pomoRound >= 4
                    ? "bg-purple-50 text-purple-900 border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-brand/10 text-brand border-brand/20"
              }`}
            >
              {mode === "break" ? (
                <>
                  <Coffee size={14} className={pomoRound >= 4 ? "text-purple-600" : "text-emerald-600"} />
                  <span>
                    {pomoRound >= 4 ? "Deep Recharge" : "Restorative Break"} ({Math.round(duration / 60)}m)
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-brand" />
                  <span>Focus Sprint {pomoRound}/4 ({Math.round(duration / 60)}m)</span>
                </>
              )}
            </div>

            {mode === "break" ? (
              <button
                type="button"
                onClick={endBreakToFocus}
                className="text-xs font-semibold text-ink-muted hover:text-ink underline px-1 cursor-pointer transition-colors"
                title="Finish break early and return to focus"
              >
                Skip break ➔
              </button>
            ) : (
              <button
                type="button"
                onClick={startBreak}
                className="text-xs font-semibold text-ink-muted/70 hover:text-ink flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-surface-sunken transition-colors cursor-pointer"
                title="Take a quick restorative rest"
              >
                <Coffee size={12} />
                <span>Take a break</span>
              </button>
            )}
          </div>

          {/* Quiet Utility Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowBreathing(true)}
              className="h-8 px-2.5 rounded-xl border border-edge bg-surface-sunken hover:bg-surface text-ink-muted hover:text-ink text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="2-minute breathing reset"
            >
              <Wind size={13} className="text-secondary" />
              <span className="hidden sm:inline">Breathe</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                setShowSummary(true);
              }}
              className="h-8 w-8 rounded-xl border border-edge bg-surface-sunken hover:bg-surface text-ink-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              title="Today's Recap"
            >
              <Award size={13} className="text-amber-500" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="h-8 w-8 rounded-xl border border-edge bg-surface-sunken hover:bg-surface text-ink-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              title="Fullscreen Mode"
            >
              <Maximize2 size={13} />
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="h-8 w-8 rounded-xl border border-edge bg-surface-sunken hover:bg-surface text-ink-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
              title="Settings"
            >
              <SettingsIcon size={13} />
            </button>
          </div>
        </div>

        {/* --- Anchor Headline / Input --- */}
        <div className="text-center min-h-[3rem] mb-6">
          {mode === "break" ? (
            <div className="flex flex-col items-center">
              <h2 className="font-fredoka text-xl sm:text-2xl font-bold text-emerald-900 leading-snug">
                Time to unplug & recharge 🍵
              </h2>
              <p className="text-xs text-emerald-800/80 mt-1">
                Step away from the screen, stretch, drink water, or take a deep breath.
              </p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                {currentMission ? (
                  <motion.div
                    key={currentMission}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <h2 className="font-fredoka text-xl sm:text-2xl font-bold text-ink leading-snug break-words">
                      {currentMission}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setCurrentMission("")}
                      className="text-xs text-ink-muted/60 hover:text-ink underline ml-1 cursor-pointer"
                      title="Change anchor"
                    >
                      edit
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="quick"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleCreateTempMission}
                    className="flex items-center justify-center gap-2 max-w-md mx-auto"
                  >
                    <input
                      id="quick-focus-input"
                      type="text"
                      value={tempFocusTitle}
                      onChange={(e) => setTempFocusTitle(e.target.value)}
                      placeholder="What is your focus anchor right now?"
                      className="flex-1 bg-transparent border-b-2 border-edge focus:border-brand outline-none text-center text-lg sm:text-xl font-fredoka font-semibold text-ink placeholder:text-ink-muted/50 py-1 transition-colors"
                    />
                    {tempFocusTitle.trim() && (
                      <button
                        type="submit"
                        aria-label="Set anchor"
                        className="h-8 px-3 rounded-full bg-brand text-white text-xs font-bold font-fredoka flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Plus size={14} /> Set
                      </button>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="text-xs text-ink-muted/80 mt-1.5">
                No rush, no urgent finish line. You are simply showing up for this tender slice of time.
              </p>
            </>
          )}
        </div>

        {/* --- Authentic Time Timer Analog Dial Centerpiece --- */}
        <div className="relative flex flex-col items-center justify-center my-3">
          {/* Subtle pulsating halo behind dial */}
          <div
            className={`absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full transition-all duration-1000 ease-in-out pointer-events-none -z-0 ${
              mode === "break"
                ? pomoRound >= 4
                  ? "bg-purple-500/10"
                  : "bg-emerald-500/10"
                : "bg-brand/10"
            } ${isRunning ? "scale-105 opacity-80" : "scale-95 opacity-20"}`}
          />

          <div
            onClick={handleStartPause}
            className="relative w-68 h-68 sm:w-76 sm:h-76 flex items-center justify-center cursor-pointer select-none group"
            title={isRunning ? "Click to Pause" : "Click to Resume"}
          >
            <svg
              viewBox="0 0 320 320"
              className="w-full h-full drop-shadow-xl overflow-visible"
            >
              {/* Dial Disk Face: Charcoal */}
              <circle cx={cx} cy={cy} r={dialR} fill="#1e2227" />

              {/* Countdown Wedge (Focus Red, Short Break Emerald, Deep Recharge Lavender) */}
              {dialWedgePath === "FULL" ? (
                <circle cx={cx} cy={cy} r={dialR} fill={wedgeColor} />
              ) : dialWedgePath ? (
                <path d={dialWedgePath} fill={wedgeColor} />
              ) : null}

              {/* Dial Ticks (radial tick marks) */}
              {ticks.map((t) => (
                <line
                  key={t.i}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.stroke}
                  strokeWidth={t.strokeWidth}
                  strokeLinecap="round"
                />
              ))}

              {/* Outer Numbers (0, 5, 10, ..., 55 counter-clockwise) */}
              {dialNumbers.map(({ m, x, y }) => (
                <text
                  key={m}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="600"
                  className="select-none font-mono"
                >
                  {m}
                </text>
              ))}

              {/* Center Hub: Dark tactile center cap */}
              <circle
                cx={cx}
                cy={cy}
                r="46"
                fill="#121519"
                stroke="#2d333b"
                strokeWidth="2.5"
                className="drop-shadow-md"
              />
            </svg>

            {/* Center Digital Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span
                role="timer"
                aria-live="polite"
                aria-label={`${formatTime(timeLeft)} remaining`}
                className="font-fredoka text-3xl sm:text-4xl font-extrabold text-white tracking-tight tabular-nums leading-none"
              >
                {formatTime(timeLeft)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mt-1">
                {mode === "break" ? (pomoRound >= 4 ? "Recharge" : "Break") : "Sprint"}
              </span>
            </div>

            {/* Pause overlay pulse when timer is not running */}
            {!isRunning && timeLeft > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white/90 shadow-lg border border-white/10 animate-pulse">
                  <Play size={18} className="fill-current translate-x-0.5" />
                </div>
              </div>
            )}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 mt-3 px-3.5 py-1 rounded-full bg-surface-sunken text-ink text-[11px] font-medium border border-edge/60">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>
              {isRunning
                ? mode === "break"
                  ? pomoRound >= 4
                    ? "Deep recharge active 🏕️"
                    : "Resting softly 🍵"
                  : "In gentle focus 🌿"
                : "Paused softly · Take a breath"}
            </span>
          </div>

          {/* 4-Stage Garden Progress Tracker */}
          <div className="mt-4 flex flex-col items-center gap-1.5 select-none">
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4].map((step) => {
                const isCompleted = pomoRound > step;
                const isCurrent = pomoRound === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      setPomoRound(step);
                      onGubbyMessage(`Set to Pomodoro Round ${step} of 4. 🌱`, "cozy");
                    }}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all cursor-pointer ${
                      isCompleted
                        ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-400 text-emerald-600 dark:text-emerald-400"
                        : isCurrent
                        ? "bg-amber-50 dark:bg-amber-950/80 border-amber-500 text-amber-600 dark:text-amber-400 scale-110 ring-2 ring-amber-500/30"
                        : "bg-surface-sunken border-edge text-ink-muted/30"
                    }`}
                    title={`Jump to Round ${step} of 4`}
                  >
                    {isCompleted ? (
                      <span className="text-sm">🌸</span>
                    ) : isCurrent ? (
                      <span className="text-sm animate-pulse">🌱</span>
                    ) : (
                      <span className="text-xs">⚪</span>
                    )}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] font-bold text-ink-muted uppercase tracking-widest font-mono">
              {mode === "break"
                ? pomoRound >= 4
                  ? "🏕️ Deep Recharge in progress"
                  : `🍵 Short Break · Round ${pomoRound} of 4`
                : `🍅 Focus Sprint · Round ${pomoRound} of 4`}
            </span>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center justify-center gap-3 mt-5 z-10 w-full max-w-xs">
            <button
              id="timer-reset-btn"
              onClick={handleReset}
              className="w-12 h-12 rounded-full bg-surface-sunken hover:bg-surface border border-edge text-ink-muted hover:text-ink flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
              title="Reset timer"
              aria-label="Reset timer"
            >
              <RotateCcw size={17} />
            </button>

            <button
              id="timer-play-pause-btn"
              onClick={handleStartPause}
              aria-label={isRunning ? "Pause Session" : "Start Session"}
              className={`flex-1 h-13 rounded-full text-white font-fredoka text-base font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer ${
                mode === "break"
                  ? pomoRound >= 4
                    ? "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  : "bg-brand hover:bg-brand-hover shadow-brand/20"
              }`}
            >
              {isRunning ? (
                <>
                  <Pause size={18} className="fill-current" />
                  <span>{mode === "break" ? "Pause Rest" : "Pause Peacefully"}</span>
                </>
              ) : (
                <>
                  <Play size={18} className="fill-current ml-0.5" />
                  <span>
                    {timeLeft < duration
                      ? "Resume"
                      : mode === "break"
                      ? "Start Rest"
                      : "Start Sprint"}
                  </span>
                </>
              )}
            </button>

            {mode !== "break" && currentMission ? (
              <button
                id="timer-complete-btn"
                onClick={handleCompleteMission}
                className="w-12 h-12 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/30 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                title="Mark task completed"
                aria-label="Complete task"
              >
                <Check size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <div className="w-12 h-12" aria-hidden="true" />
            )}
          </div>

          {/* Gentle ADHD Guardrails: Ride the Flow (+10m) / Breathe */}
          <div className="flex items-center gap-2 mt-4 z-10 flex-wrap justify-center">
            {mode === "focus" ? (
              <button
                type="button"
                onClick={rideFlow}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                title="Extend focus session by 10 minutes without breaking stride"
              >
                <Zap size={14} className="text-amber-500 fill-amber-500" />
                <span>Ride the Flow (+10m)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowBreathing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary/15 hover:bg-secondary/25 text-ink text-xs font-bold border border-secondary/30 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Wind size={14} className="text-secondary" />
                <span>Take 3 calming deep breaths 🌬️</span>
              </button>
            )}

            {/* Quick Cadence Adjusters */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => adjustTime(-300)}
                className="px-2.5 py-1.5 rounded-full bg-surface-sunken hover:bg-surface border border-edge/80 text-ink-muted hover:text-ink font-semibold transition-colors cursor-pointer text-xs"
              >
                -5m
              </button>
              <button
                type="button"
                onClick={() => adjustTime(300)}
                className="px-2.5 py-1.5 rounded-full bg-surface-sunken hover:bg-surface border border-edge/80 text-ink-muted hover:text-ink font-semibold transition-colors cursor-pointer text-xs"
              >
                +5m
              </button>
            </div>
          </div>
        </div>

        {/* --- Clean Sensory Audio & Bell Strip --- */}
        <div className="mt-6 pt-5 border-t border-edge flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Soundscapes */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mr-1" style={{ fontFamily: MONO_FONT }}>
              Soundscape:
            </span>
            <button
              type="button"
              onClick={() => handleToggleSoundscape("rain")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeSoundscape === "rain"
                  ? "bg-secondary/15 text-secondary border-secondary"
                  : "bg-surface-sunken text-ink-muted border-edge hover:text-ink"
              }`}
            >
              <CloudRain size={13} />
              <span>Rain</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSoundscape("fire")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeSoundscape === "fire"
                  ? "bg-amber-500/15 text-amber-600 border-amber-500"
                  : "bg-surface-sunken text-ink-muted border-edge hover:text-ink"
              }`}
            >
              <Flame size={13} />
              <span>Fire</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSoundscape("brook")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeSoundscape === "brook"
                  ? "bg-sky-500/15 text-sky-600 border-sky-500"
                  : "bg-surface-sunken text-ink-muted border-edge hover:text-ink"
              }`}
            >
              <Waves size={13} />
              <span>Brook</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSoundscape("binaural_40hz")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeSoundscape === "binaural_40hz"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500 ring-2 ring-purple-500/20 font-bold"
                  : "bg-surface-sunken text-ink-muted border-edge hover:text-ink"
              }`}
              title="Dr. Andrew Huberman 40 Hz Gamma Focus (Stereo headphones required)"
            >
              <Headphones size={13} className={activeSoundscape === "binaural_40hz" ? "text-purple-600 dark:text-purple-400" : ""} />
              <span>40Hz Huberman</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSoundscape("binaural_10hz")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeSoundscape === "binaural_10hz"
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500 ring-2 ring-indigo-500/20 font-bold"
                  : "bg-surface-sunken text-ink-muted border-edge hover:text-ink"
              }`}
              title="10 Hz Alpha Calm & Relaxation (Stereo headphones required)"
            >
              <Headphones size={13} className={activeSoundscape === "binaural_10hz" ? "text-indigo-600 dark:text-indigo-400" : ""} />
              <span>10Hz Alpha</span>
            </button>

            {activeSoundscape && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(soundscapeVol * 100)}
                  onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                  className="w-16 h-1.5 bg-surface-sunken rounded-lg appearance-none cursor-pointer accent-brand"
                  title="Soundscape volume"
                />
              </div>
            )}
          </div>

          {/* Bell & Pacing */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerBellTest}
              className="px-3 py-1.5 rounded-full border border-edge bg-surface-sunken hover:bg-surface text-ink-muted hover:text-ink text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Test soft Tibetan singing bowl bell"
            >
              <Bell size={13} className="text-amber-500" />
              <span>Tibetan Bell</span>
            </button>

            <button
              type="button"
              onClick={() => setPacingEnabled(!pacingEnabled)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                pacingEnabled
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-edge bg-surface-sunken text-ink-muted hover:text-ink"
              }`}
              title="Body-double pacing tick"
            >
              Tick: {pacingEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>

        {(activeSoundscape === "binaural_40hz" || activeSoundscape === "binaural_10hz") && (
          <p className="text-center text-[11px] font-medium text-purple-700 dark:text-purple-300 mt-2.5 flex items-center justify-center gap-1.5 animate-fade-in bg-purple-500/10 py-1.5 px-3 rounded-full border border-purple-500/20 max-w-md mx-auto">
            <Headphones size={13} className="shrink-0 text-purple-600 dark:text-purple-400" />
            <span>
              <strong>Stereo headphones needed:</strong> Left (210 Hz) & Right ({activeSoundscape === "binaural_40hz" ? "250 Hz" : "220 Hz"}) synthesize the {activeSoundscape === "binaural_40hz" ? "40 Hz Huberman focus" : "10 Hz calm"} wave.
            </span>
          </p>
        )}

        {bellFeedback && (
          <p className="text-center text-xs font-semibold text-emerald-600 mt-2 animate-fade-in">
            Bell rings gently ∼
          </p>
        )}
      </section>

      {/* ============================================================ */}
      {/* TUCKED DRAWER: PICK FROM OPEN QUESTS                         */}
      {/* ============================================================ */}
      {openTasks.length > 0 && !currentMission && (
        <details className="group rounded-2xl border border-edge bg-surface card-shadow overflow-hidden">
          <summary
            className="text-xs font-bold text-ink-muted hover:text-ink cursor-pointer list-none flex items-center justify-between px-5 py-3 transition-colors select-none"
          >
            <div className="flex items-center gap-2">
              <ListTodo size={14} className="text-brand" />
              <span>Pick from {openTasks.length} open quest{openTasks.length === 1 ? "" : "s"}</span>
            </div>
            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
          </summary>
          <ul className="border-t border-edge max-h-56 overflow-y-auto divide-y divide-edge/60">
            {openTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => handlePickTask(task.title)}
                  className="w-full text-left text-sm text-ink hover:bg-surface-sunken px-5 py-2.5 transition-colors cursor-pointer truncate flex items-center justify-between"
                >
                  <span className="truncate">{task.title}</span>
                  {task.estimatedMinutes && (
                    <span className="text-xs text-ink-muted ml-2 shrink-0">{task.estimatedMinutes}m</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

    </div>
  );
}
