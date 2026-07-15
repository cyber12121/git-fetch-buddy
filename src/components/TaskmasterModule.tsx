import React, { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, AlertCircle, CheckCircle, Volume2, VolumeX, Plus, Award, Flame, Wind, Coffee, Target, Timer, Settings as SettingsIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";
import BreathingOverlay from "./BreathingOverlay";
import {
  appendSession,
  computeStats,
  formatDuration as fmtHistoryDuration,
  loadHistory,
  type SessionRecord,
} from "../lib/focusHistory";

interface TaskmasterModuleProps {
  activeTaskTitle: string | null;
  activeTaskId?: string | null;
  activeSubtaskId?: string | null;
  tasks: Task[];
  onCompleteActiveTask: (taskId: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

type PendingAction = { type: "quest" | "quick_focus"; value: string };
type TimerMode = "focus" | "pomodoro" | "break";

type DurationSettings = {
  focusMinutes: number;
  breakMinutes: number;
  pomoFocusMinutes: number;
  pomoBreakMinutes: number;
};

const DEFAULT_SETTINGS: DurationSettings = {
  focusMinutes: 50,
  breakMinutes: 5,
  pomoFocusMinutes: 25,
  pomoBreakMinutes: 5,
};

const SETTINGS_KEY = "goblin_focus_settings_v1";

const loadSettings = (): DurationSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      focusMinutes: clampMin(parsed.focusMinutes, 1, 180, DEFAULT_SETTINGS.focusMinutes),
      breakMinutes: clampMin(parsed.breakMinutes, 1, 60, DEFAULT_SETTINGS.breakMinutes),
      pomoFocusMinutes: clampMin(parsed.pomoFocusMinutes, 5, 90, DEFAULT_SETTINGS.pomoFocusMinutes),
      pomoBreakMinutes: clampMin(parsed.pomoBreakMinutes, 1, 30, DEFAULT_SETTINGS.pomoBreakMinutes),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

function clampMin(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}


export default function TaskmasterModule({
  activeTaskTitle,
  activeTaskId,
  activeSubtaskId,
  tasks,
  onCompleteActiveTask,
  onGubbyMessage
}: TaskmasterModuleProps) {
  // Configurable duration presets (persisted)
  const [settings, setSettings] = useState<DurationSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const POMODORO_FOCUS_SECS = settings.pomoFocusMinutes * 60;
  const POMODORO_BREAK_SECS = settings.pomoBreakMinutes * 60;
  const BREAK_SECS = settings.breakMinutes * 60;

  // Configurable duration (in seconds). Defaults to focus preset.
  const [duration, setDuration] = useState(() => loadSettings().focusMinutes * 60);
  const [timeLeft, setTimeLeft] = useState(() => loadSettings().focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pacingEnabled, setPacingEnabled] = useState(false); // subtle body-double ticking sound
  const [tempFocusTitle, setTempFocusTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [mode, setMode] = useState<TimerMode>("focus");
  // For pomodoro: which half of the cycle we're in.
  const [pomoPhase, setPomoPhase] = useState<"focus" | "break">("focus");
  const [pomoRound, setPomoRound] = useState(1);
  const [showBreathing, setShowBreathing] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const stats = useMemo(() => computeStats(history), [history]);

  // Helper to get today's key format YYYY-MM-DD
  const getTodayKey = () => {
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Focus Session Tracking (highly valuable for ADHD progress logging - persisted all day!)
  const [sessionFocusSeconds, setSessionFocusSeconds] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const key = `goblin_focus_seconds_${getTodayKey()}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) return parsed;
    }
    // Legacy fallback
    const legacy = localStorage.getItem("goblin_session_seconds");
    if (legacy !== null) {
      const parsed = parseInt(legacy, 10);
      if (Number.isFinite(parsed) && !Number.isNaN(parsed)) return parsed;
    }
    return 0;
  });

  const [completedMissions, setCompletedMissions] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const key = `goblin_focus_completed_${getTodayKey()}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        // corrupted value; fall through to defaults
      }
    }
    // Legacy fallback
    const legacy = localStorage.getItem("goblin_session_completed");
    if (legacy !== null) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        // corrupted value; fall through to defaults
      }
    }
    return [];
  });

  const [showSummary, setShowSummary] = useState(false);
  const [activeSessionSeconds, setActiveSessionSeconds] = useState<number>(0);

  useEffect(() => {
    const key = `goblin_focus_seconds_${getTodayKey()}`;
    localStorage.setItem(key, sessionFocusSeconds.toString());
  }, [sessionFocusSeconds]);

  useEffect(() => {
    const key = `goblin_focus_completed_${getTodayKey()}`;
    localStorage.setItem(key, JSON.stringify(completedMissions));
  }, [completedMissions]);

  // Persist duration settings, and if the timer is idle for the current mode,
  // reflect the new preset immediately.
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (!isRunning) {
      const nextDur =
        mode === "break"
          ? settings.breakMinutes * 60
          : mode === "pomodoro"
          ? (pomoPhase === "break" ? settings.pomoBreakMinutes : settings.pomoFocusMinutes) * 60
          : settings.focusMinutes * 60;
      // Only reset if timer hasn't been touched (avoid clobbering task-specific durations mid-session)
      if (timeLeft === duration) {
        setDuration(nextDur);
        setTimeLeft(nextDur);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Refs mirroring latest values so the interval body always reads current data
  // without needing those values in the effect dependency list.
  const soundEnabledRef = useRef(soundEnabled);
  const pacingEnabledRef = useRef(pacingEnabled);
  const onGubbyMessageRef = useRef(onGubbyMessage);
  const handleTimerCompleteRef = useRef<() => void>(() => {});

  // Synchronize loaded task title changes
  const [currentMission, setCurrentMission] = useState(activeTaskTitle || "");
  const lastLoadedTaskRef = useRef<string | null>(null);

  useEffect(() => {
    // When no mission is loaded (or after one completes), reset the ref so the
    // same task can be re-focused later and reload the timer fresh.
    if (!activeTaskTitle) {
      lastLoadedTaskRef.current = null;
      return;
    }
    if (activeTaskTitle !== lastLoadedTaskRef.current) {
      lastLoadedTaskRef.current = activeTaskTitle;
      setCurrentMission(activeTaskTitle);
      
      // Look up task estimate (e.g. 30 minutes, or the custom estimate set on the task)
      let matchingMinutes = 25; // Default fallback estimate
      const parentTitle = activeTaskTitle.includes(" ➔ ") 
        ? activeTaskTitle.split(" ➔ ")[0].trim() 
        : activeTaskTitle.trim();
        
      const matchedTask = tasks.find(t => t.title.trim().toLowerCase() === parentTitle.toLowerCase());
      if (matchedTask) {
        matchingMinutes = matchedTask.estimatedMinutes !== undefined 
          ? matchedTask.estimatedMinutes 
          : 25;
      }
      
      const newDurationSeconds = matchingMinutes * 60;
      setDuration(newDurationSeconds);
      setTimeLeft(newDurationSeconds);
      setIsRunning(false);
      setActiveSessionSeconds(0); // Reset session focus counter for the new task
      
      const h = Math.floor(matchingMinutes / 60);
      const m = matchingMinutes % 60;
      const estimateText = h > 0 ? `${h}h ${m}m` : `${matchingMinutes}m`;
      onGubbyMessage(`Mission Loaded: "${activeTaskTitle}". Automatically adjusted timer to ${estimateText}! ⏱️🦉`, "focused");
    }
  }, [activeTaskTitle, tasks]);

  // Handle timer countdown
  // Driven by a single interval that targets an absolute end timestamp so the
  // countdown stays accurate even when the tab is throttled in the background.
  // All side effects (focus credit, gubby messages, completion) happen OUTSIDE
  // the state updaters, which only do pure arithmetic — this keeps StrictMode
  // double-invocation from double-firing them.
  useEffect(() => {
    if (!isRunning) return;

    const endAt = Date.now() + timeLeft * 1000;
    let activeElapsed = activeSessionSeconds;

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));

      // Pure setters — no side effects inside.
      setTimeLeft(remaining);
      activeElapsed += 1;
      setActiveSessionSeconds(activeElapsed);

      // Focus-credit logic runs here (outside any updater).
      if (activeElapsed === 600) {
        // Reached exactly 10 minutes: credit the full 10 minutes at once!
        setSessionFocusSeconds((s) => s + 600);
        onGubbyMessageRef.current("Incredible focus! You've crossed the 10-minute threshold! Your session is now officially counted. 🦉🔥", "excited");
      } else if (activeElapsed > 600) {
        // Over 10 minutes: credit in real-time second-by-second.
        setSessionFocusSeconds((s) => s + 1);
      }

      // Optional body-double tick (reads latest sound/pacing via refs).
      if (pacingEnabledRef.current && activeElapsed % 2 === 0) {
        playTickSound();
      }

      // Completion: call the handler from the interval body, not an updater.
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        handleTimerCompleteRef.current();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const playTickSound = () => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio blocked", e);
    }
  };

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error("Web Audio API not supported");
      audioContextRef.current = new AudioCtor();
    }
    return audioContextRef.current;
  };

  const playChime = (type: "start" | "pause" | "victory") => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      
      if (type === "start") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "victory") {
        const notes = [261.63, 329.63, 392.00, 523.25]; // C major triad
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
          gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
        });
      } else if (type === "pause") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (err) {
      console.warn("Audio Context failed", err);
    }
  };

  const handleStartPause = () => {
    if (!currentMission) {
      onGubbyMessage("Wait! You must type or pick a mission to focus on first!", "thoughtful");
      return;
    }
    const nextState = !isRunning;
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

  const logSession = (
    logMode: SessionRecord["mode"],
    title: string,
    seconds: number
  ) => {
    if (seconds < 5) return; // ignore accidental sub-5s runs
    const next = appendSession({ mode: logMode, title, seconds });
    setHistory(next);
  };

  const switchMode = (next: TimerMode) => {
    if (isRunning) setIsRunning(false);
    setMode(next);
    setPomoPhase("focus");
    setPomoRound(1);
    const dur = next === "break" ? BREAK_SECS : next === "pomodoro" ? POMODORO_FOCUS_SECS : settings.focusMinutes * 60;
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
    const elapsed = duration; // whole duration ran to zero
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
        setIsRunning(true); // auto-start break
      } else {
        logSession("break", "Pomodoro break", elapsed);
        onGubbyMessage("Break done — back to focus! 🔥", "excited");
        setPomoPhase("focus");
        setPomoRound((r) => r + 1);
        setDuration(POMODORO_FOCUS_SECS);
        setTimeLeft(POMODORO_FOCUS_SECS);
        setActiveSessionSeconds(0);
        setIsRunning(true); // auto-start next focus
      }
      return;
    }

    // Classic focus
    onGubbyMessage("TIME IS UP! Absolute stellar work! Celebrate taking action! 🎉", "excited");
    if (currentMission) {
      logSession("focus", currentMission, elapsed);
      if (activeTaskId) {
        onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
      }
      const completedTask = currentMission;
      setCompletedMissions((prev) => (prev.includes(completedTask) ? prev : [...prev, completedTask]));
      setCurrentMission("");
      setTempFocusTitle("");
    }
    setActiveSessionSeconds(0);
  };


  // Keep interval-body refs pointed at the latest function/prop identities.
  soundEnabledRef.current = soundEnabled;
  pacingEnabledRef.current = pacingEnabled;
  onGubbyMessageRef.current = onGubbyMessage;
  handleTimerCompleteRef.current = handleTimerComplete;

  const executeAction = (action: PendingAction) => {
    if (action.type === "quest") {
      const title = action.value;
      setCurrentMission(title);
      setTimeLeft(duration);
      setIsRunning(false);
      setActiveSessionSeconds(0);
      onGubbyMessage(`Loaded task: "${title}". Let's crush this!`, "focused");
    } else if (action.type === "quick_focus") {
      const title = action.value;
      setCurrentMission(title);
      setTimeLeft(duration);
      setIsRunning(false);
      setActiveSessionSeconds(0);
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
    }
    onGubbyMessage(`Amazing! Quest "${currentMission}" completed! Victory dance! 🦖💃`, "happy");
    logSession(mode === "break" ? "break" : mode === "pomodoro" ? "pomodoro" : "focus", currentMission, elapsed);
    const completedTask = currentMission;
    if (mode !== "break") {
      setCompletedMissions((prev) => (prev.includes(completedTask) ? prev : [...prev, completedTask]));
    }
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

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const formatFocusDuration = (totalSeconds: number) => {
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins < 60) {
      return `${mins}m ${secs}s`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ${secs}s`;
  };

  const getGubbyResponse = (seconds: number, tasksCount: number) => {
    if (seconds === 0 && tasksCount === 0) {
      return "No worries! Showing up and looking at your dashboard is a great first step. Let's start whenever you're ready! 🌱";
    }
    if (seconds < 60) {
      return `A quick focus spark of ${seconds} seconds! Even brief moments help break the initial inertia. Step by step, we build momentum! 🍃`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 5) {
      return `Nice brief focus sprint of ${minutes}m! Perfect for small, bite-sized micro-tasks. Every little bit counts! ⚡`;
    } else if (minutes < 25) {
      return `Superb effort! ${minutes} minutes of solid, uninterrupted focus. Your brain is getting into a beautiful flow state! 🧠✨`;
    } else if (minutes < 50) {
      return `Phenomenal hyper-focus! ${minutes} minutes of deep work is a major victory. You conquered those distraction dragons! 🐉🏆`;
    } else {
      return `Legendary master-class focus! ${minutes} minutes of epic deep work. You are officially unstoppable! Remember to stretch and drink some water! 💧👑`;
    }
  };

  const handleStartNewSession = () => {
    setSessionFocusSeconds(0);
    setCompletedMissions([]);
    setShowSummary(false);
    setActiveSessionSeconds(0);
    onGubbyMessage("New focus session started! Fresh energy, fresh start. Let's go! 🌟", "happy");
  };

  // ─────────────────── SUMMARY VIEW ───────────────────
  if (showSummary) {
    return (
      <div id="taskmaster-summary-module" className="max-w-2xl mx-auto px-1 sm:px-0 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">Session recap</div>
            <h1 className="text-3xl font-fredoka font-bold text-ink mt-1">Nice work.</h1>
          </div>

          <div className="grid grid-cols-2 gap-px bg-edge rounded-2xl overflow-hidden border border-edge">
            <div className="bg-surface-sunken p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Focused</div>
              <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} className="text-4xl font-bold text-ink tabular-nums mt-2">
                {formatFocusDuration(sessionFocusSeconds)}
              </div>
            </div>
            <div className="bg-surface-sunken p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Cleared</div>
              <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} className="text-4xl font-bold text-ink tabular-nums mt-2">
                {completedMissions.length}
              </div>
            </div>
          </div>

          {completedMissions.length > 0 && (
            <ul className="space-y-2">
              {completedMissions.map((title, i) => (
                <motion.li
                  key={`${i}-${title}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2.5 text-sm text-ink"
                >
                  <CheckCircle size={14} className="text-success shrink-0" />
                  <span className="truncate">{title}</span>
                </motion.li>
              ))}
            </ul>
          )}

          <p className="text-sm text-ink-muted leading-relaxed border-l-2 border-brand pl-4">
            {getGubbyResponse(sessionFocusSeconds, completedMissions.length)}
          </p>

          <div className="flex gap-2">
            <button
              id="summary-back-btn"
              onClick={() => setShowSummary(false)}
              className="flex-1 h-12 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-sm rounded-xl transition-all cursor-pointer"
              style={{ boxShadow: "var(--theme-glow)" }}
            >
              Back to timer
            </button>
            <button
              id="summary-reset-session-btn"
              onClick={() => {
                if (window.confirm("Reset all focus stats for today?")) handleStartNewSession();
              }}
              className="px-5 h-12 bg-surface-sunken hover:bg-surface-raised text-ink-muted font-bold text-sm rounded-xl border border-edge cursor-pointer"
            >
              Reset day
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────── MAIN — MINIMAL ONE-THING VIEW ───────────────────
  const remainingRatio = duration > 0 ? timeLeft / duration : 1;
  const donePct = Math.round((1 - remainingRatio) * 100);
  const zone = remainingRatio <= 0.1 ? "danger" : remainingRatio <= 0.2 ? "warn" : "brand";
  const zoneColor = zone === "danger" ? "var(--color-danger)" : zone === "warn" ? "var(--color-warn)" : "var(--color-brand)";
  const status = isRunning ? "focusing" : timeLeft === duration ? "ready" : "paused";
  const monoFont = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
  const bodyFont = "'Work Sans', system-ui, sans-serif";
  const openTasks = tasks.filter(t => !t.completed);

  return (
    <div
      id="taskmaster-module"
      className="max-w-xl mx-auto px-1 sm:px-0 pb-10"
      style={{ fontFamily: bodyFont }}
    >
      {/* Pending-action modal */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-canvas/85 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="max-w-sm w-full bg-surface-sunken border border-edge rounded-2xl p-6 text-center space-y-4">
              <AlertCircle size={24} className="text-warn mx-auto" />
              <h3 className="text-base font-bold text-ink">Reset focus progress?</h3>
              <p className="text-xs text-ink-muted">Loading a new mission will discard your active countdown.</p>
              <div className="flex gap-2">
                <button
                  id="confirm-action-yes-btn"
                  onClick={() => executeAction(pendingAction)}
                  className="flex-1 h-10 bg-danger text-white font-bold text-xs rounded-lg cursor-pointer"
                >Yes, switch</button>
                <button
                  id="confirm-action-no-btn"
                  onClick={() => setPendingAction(null)}
                  className="flex-1 h-10 bg-surface-raised text-ink-muted font-bold text-xs rounded-lg border border-edge cursor-pointer"
                >Keep going</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breathing overlay */}
      <AnimatePresence>
        {showBreathing && (
          <BreathingOverlay
            monoFont={monoFont}
            onClose={() => setShowBreathing(false)}
            onComplete={(secs) => {
              logSession("breathe", "4-7-8 breathing", secs);
              setShowBreathing(false);
              onGubbyMessage("Breathing complete. Nervous system, downshifted. 🌬️", "cozy");
            }}
          />
        )}
      </AnimatePresence>

      {/* Tiny top row — status pill + streak + recap */}
      <div className="flex items-center justify-between mb-6">
        <div
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted"
          style={{ fontFamily: monoFont }}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? "bg-success animate-pulse" : status === "paused" ? "bg-warn" : "bg-ink-muted/50"
            }`}
          />
          {mode === "pomodoro" ? `pomo r${pomoRound} · ${pomoPhase}` : mode} · {status}
        </div>
        <div className="flex items-center gap-3">
          {stats.streak > 0 && (
            <div
              className="flex items-center gap-1 text-[11px] font-bold text-brand"
              style={{ fontFamily: monoFont }}
              title="Consecutive days with a counted focus session"
            >
              <Flame size={12} /> {stats.streak}d
            </div>
          )}
          <button
            id="timer-view-summary-btn"
            onClick={() => { setIsRunning(false); setShowSummary(true); }}
            className="text-[11px] font-bold text-ink-muted hover:text-ink flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Award size={12} /> Recap
          </button>
        </div>
      </div>

      {/* Mode selector — tiny segmented row */}
      <div
        className="flex items-center justify-center gap-1 mb-8 p-1 bg-surface-sunken border border-edge rounded-full max-w-md mx-auto"
        style={{ fontFamily: monoFont }}
        role="tablist"
        aria-label="Timer mode"
      >
        {([
          { id: "focus" as const, label: "Focus", Icon: Target },
          { id: "pomodoro" as const, label: "Pomodoro", Icon: Timer },
          { id: "break" as const, label: "Break", Icon: Coffee },
        ]).map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(id)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
                active ? "bg-brand text-primary-foreground" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowBreathing(true)}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-ink cursor-pointer border-l border-edge ml-1"
          title="3-2-1 breathing"
        >
          <Wind size={11} />
          <span className="hidden sm:inline">Breathe</span>
        </button>
      </div>



      {/* Mission — single line, no card */}
      <div className="mb-8 text-center min-h-[3rem]">
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

      {/* MEGA TIMER — the hero */}
      <div className="text-center mb-6">
        <div
          role="timer"
          aria-live="polite"
          aria-label={`${formatTime(timeLeft)} remaining, ${status}`}
          className="font-bold tabular-nums leading-none tracking-tight select-none transition-colors duration-700"
          style={{
            fontFamily: monoFont,
            fontSize: "clamp(5rem, 22vw, 11rem)",
            color: zoneColor,
            textShadow: isRunning ? `0 0 60px ${zoneColor}44` : "none",
            letterSpacing: "-0.04em",
          }}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* THIN linear progress */}
      <div className="h-[2px] w-full bg-edge/50 relative overflow-hidden rounded-full mb-10">
        <motion.div
          className="h-full absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: zoneColor, boxShadow: `0 0 10px ${zoneColor}` }}
          animate={{ width: `${donePct}%` }}
          transition={{ duration: 0.6, ease: "linear" }}
        />
      </div>

      {/* CONTROL DECK — one hero, two whispers */}
      <div className="flex items-center justify-center gap-3 mb-8">
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

      {/* Micro meta line — mono, quiet */}
      <div
        className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted mb-10"
        style={{ fontFamily: monoFont }}
      >
        <span>{donePct}%</span>
        <span className="text-ink-muted/40">·</span>
        <span>{Math.floor(duration / 60)}m goal</span>
        <span className="text-ink-muted/40">·</span>
        <button
          id="sound-fx-toggle"
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? "Mute chimes" : "Enable chimes"}
          className={`inline-flex items-center hover:text-ink transition-colors cursor-pointer ${soundEnabled ? "text-brand" : ""}`}
        >
          {soundEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
        </button>
        <button
          id="body-double-pacing-toggle"
          onClick={() => setPacingEnabled(!pacingEnabled)}
          aria-label={pacingEnabled ? "Turn off body-double tick" : "Turn on body-double tick"}
          className={`inline-flex items-center hover:text-ink transition-colors cursor-pointer ${pacingEnabled ? "text-brand" : ""}`}
        >
          <span className="text-[10px]">tick</span>
        </button>
      </div>

      {/* Today strip — flat, mono, no cards */}
      <div className="grid grid-cols-2 border-t border-b border-edge">
        <div className="py-4 px-4 text-center border-r border-edge">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-ink-muted" style={{ fontFamily: monoFont }}>
            Focused today
          </div>
          <div
            className="text-2xl font-bold text-ink tabular-nums mt-1"
            style={{ fontFamily: monoFont }}
          >
            {formatFocusDuration(sessionFocusSeconds)}
          </div>
        </div>
        <div className="py-4 px-4 text-center">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-ink-muted" style={{ fontFamily: monoFont }}>
            Cleared
          </div>
          <div
            className="text-2xl font-bold text-ink tabular-nums mt-1"
            style={{ fontFamily: monoFont }}
          >
            {completedMissions.length}
          </div>
        </div>
      </div>

      {activeSessionSeconds > 0 && activeSessionSeconds < 600 && (
        <div className="mt-3 text-center text-[10px] font-bold text-brand" style={{ fontFamily: monoFont }}>
          run {Math.floor(activeSessionSeconds / 60)}m {activeSessionSeconds % 60}s / 10m to count
        </div>
      )}
      {activeSessionSeconds >= 600 && (
        <div className="mt-3 text-center text-[10px] font-bold text-success" style={{ fontFamily: monoFont }}>
          this run is counted
        </div>
      )}

      {/* Quest picker — collapsible, no visual weight */}
      {!currentMission && openTasks.length > 0 && (
        <details className="mt-8 group">
          <summary className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink cursor-pointer list-none flex items-center justify-center gap-1.5" style={{ fontFamily: monoFont }}>
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            or pick from {openTasks.length} open quest{openTasks.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-4 space-y-1 max-h-56 overflow-y-auto">
            {openTasks.map(task => (
              <li key={task.id}>
                <button
                  id={`quick-pick-task-${task.id}`}
                  onClick={() => {
                    const hasProgress = timeLeft < duration && timeLeft > 0;
                    if (hasProgress) {
                      setPendingAction({ type: "quest", value: task.title });
                      setIsRunning(false);
                    } else {
                      setCurrentMission(task.title);
                      setTimeLeft(duration);
                      setIsRunning(false);
                      setActiveSessionSeconds(0);
                      onGubbyMessage(`Loaded task: "${task.title}". Let's crush this!`, "focused");
                    }
                  }}
                  className="w-full text-left text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-lg px-3 py-2 transition-colors cursor-pointer truncate"
                >
                  {task.title}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ── HISTORY & STREAK PANEL ─────────────────────────────── */}
      <div className="mt-10 border-t border-edge pt-8">
        <div
          className="grid grid-cols-4 gap-px bg-edge rounded-2xl overflow-hidden border border-edge mb-4"
          style={{ fontFamily: monoFont }}
        >
          <div className="bg-surface-sunken p-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted flex items-center justify-center gap-1">
              <Flame size={10} /> Streak
            </div>
            <div className="text-xl font-bold text-brand tabular-nums mt-1">{stats.streak}d</div>
          </div>
          <div className="bg-surface-sunken p-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Today</div>
            <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.todayFocusSeconds)}</div>
          </div>
          <div className="bg-surface-sunken p-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">All time</div>
            <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.totalFocusSeconds)}</div>
          </div>
          <div className="bg-surface-sunken p-3 text-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Best day</div>
            <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.bestDaySeconds)}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="w-full text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink cursor-pointer flex items-center justify-center gap-1.5 py-2"
          style={{ fontFamily: monoFont }}
        >
          <span className={`inline-block transition-transform ${showHistory ? "rotate-90" : ""}`}>›</span>
          {stats.totalSessions === 0
            ? "no sessions logged yet"
            : `history · ${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"}`}
        </button>

        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 max-h-64 overflow-y-auto divide-y divide-edge/60 border border-edge rounded-xl bg-surface-sunken"
            >
              {[...history].reverse().slice(0, 40).map((r) => {
                const d = new Date(r.at);
                const when = d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                  " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                const modeIcon =
                  r.mode === "focus" ? <Target size={11} className="text-brand" /> :
                  r.mode === "pomodoro" ? <Timer size={11} className="text-brand" /> :
                  r.mode === "break" ? <Coffee size={11} className="text-ink-muted" /> :
                  <Wind size={11} className="text-accent" />;
                return (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="shrink-0">{modeIcon}</span>
                    <span className="flex-1 min-w-0 truncate text-ink">{r.title}</span>
                    <span
                      className="tabular-nums text-ink-muted"
                      style={{ fontFamily: monoFont }}
                    >
                      {fmtHistoryDuration(r.seconds)}
                    </span>
                    <span
                      className="tabular-nums text-ink-muted/70 text-[10px] hidden sm:inline"
                      style={{ fontFamily: monoFont }}
                    >
                      {when}
                    </span>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Footnote */}
      <p className="mt-8 text-center text-[10px] text-ink-muted/70" style={{ fontFamily: monoFont }}>
        sessions ≥ 10min count · deep flow gets the credit
      </p>
    </div>
  );
}


