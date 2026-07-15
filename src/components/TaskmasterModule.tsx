import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, AlertCircle, CheckCircle, Volume2, VolumeX, Trophy, Plus, Award, Clock, Zap, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task } from "../types";

interface TaskmasterModuleProps {
  activeTaskTitle: string | null;
  activeTaskId?: string | null;
  activeSubtaskId?: string | null;
  tasks: Task[];
  onCompleteActiveTask: (taskId: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
}

type PendingAction = { type: "quest" | "quick_focus"; value: string };

export default function TaskmasterModule({
  activeTaskTitle,
  activeTaskId,
  activeSubtaskId,
  tasks,
  onCompleteActiveTask,
  onGubbyMessage
}: TaskmasterModuleProps) {
  // Configurable duration (in seconds). Defaults to 50:00 (3000s)
  const [duration, setDuration] = useState(3000);
  const [timeLeft, setTimeLeft] = useState(3000);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [pacingEnabled, setPacingEnabled] = useState(false); // subtle body-double ticking sound
  const [tempFocusTitle, setTempFocusTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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

  const handleTimerComplete = () => {
    setIsRunning(false);
    playChime("victory");
    onGubbyMessage("TIME IS UP! Absolute stellar work! Celebrate taking action! 🎉", "excited");
    if (currentMission) {
      if (activeTaskId) {
        onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
      }
      const completedTask = currentMission;
      setCompletedMissions((prev) => {
        if (!prev.includes(completedTask)) {
          return [...prev, completedTask];
        }
        return prev;
      });
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
    setIsRunning(false);
    playChime("victory");
    if (activeTaskId) {
      onCompleteActiveTask(activeTaskId, activeSubtaskId ?? undefined);
    }
    onGubbyMessage(`Amazing! Quest "${currentMission}" completed! Victory dance! 🦖💃`, "happy");
    const completedTask = currentMission;
    setCompletedMissions((prev) => {
      if (!prev.includes(completedTask)) {
        return [...prev, completedTask];
      }
      return prev;
    });
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
      <div id="taskmaster-summary-module" className="max-w-3xl mx-auto px-1 sm:px-0 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Session recap</div>
              <h1 className="text-2xl sm:text-3xl font-fredoka font-bold text-ink">Nice work today</h1>
            </div>
            <Award size={28} className="text-brand" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative bg-surface-sunken border border-edge rounded-2xl p-5 overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1 bg-brand" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Focused</div>
              <div className="font-mono text-3xl sm:text-4xl font-bold text-ink tabular-nums mt-1">
                {formatFocusDuration(sessionFocusSeconds)}
              </div>
            </div>
            <div className="relative bg-surface-sunken border border-edge rounded-2xl p-5 overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1 bg-success" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Cleared</div>
              <div className="font-mono text-3xl sm:text-4xl font-bold text-ink tabular-nums mt-1">
                {completedMissions.length}
              </div>
            </div>
          </div>

          <div className="bg-surface-sunken border border-edge rounded-2xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-1.5">
              <Zap size={11} className="text-brand" /> Completed quests
            </div>
            {completedMissions.length > 0 ? (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {completedMissions.map((title, i) => (
                  <motion.li
                    key={`${i}-${title}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 text-sm font-semibold text-ink"
                  >
                    <CheckCircle size={14} className="text-success shrink-0" />
                    <span className="truncate">{title}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-muted italic">No completions logged — showing up still counts.</p>
            )}
          </div>

          <div className="bg-brand-soft/20 border border-brand/30 rounded-2xl p-4 text-sm text-ink font-semibold leading-relaxed">
            <span className="text-lg mr-2">🦉</span>{getGubbyResponse(sessionFocusSeconds, completedMissions.length)}
          </div>

          <div className="flex gap-2">
            <button
              id="summary-back-btn"
              onClick={() => setShowSummary(false)}
              className="flex-1 py-3 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-sm rounded-xl transition-all cursor-pointer"
              style={{ boxShadow: "var(--theme-glow)" }}
            >
              Back to timer
            </button>
            <button
              id="summary-reset-session-btn"
              onClick={() => {
                if (window.confirm("Reset all focus stats for today?")) handleStartNewSession();
              }}
              className="px-4 py-3 bg-surface-sunken hover:bg-surface-raised text-ink-muted font-bold text-sm rounded-xl border border-edge cursor-pointer"
            >
              Reset day
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────── MAIN COCKPIT ───────────────────
  const remainingRatio = duration > 0 ? timeLeft / duration : 1;
  const donePct = Math.round((1 - remainingRatio) * 100);
  const zone = remainingRatio <= 0.1 ? "danger" : remainingRatio <= 0.2 ? "warn" : "brand";
  const zoneColor = zone === "danger" ? "var(--color-danger)" : zone === "warn" ? "var(--color-warn)" : "var(--color-brand)";
  const status = isRunning ? "focusing" : timeLeft === duration ? "ready" : "paused";

  return (
    <div id="taskmaster-module" className="max-w-4xl mx-auto px-1 sm:px-0 pb-8">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Focus cockpit</div>
          <h1 className="text-2xl sm:text-3xl font-fredoka font-bold text-ink truncate">
            {isRunning ? "In flow" : status === "paused" ? "Held" : "Ready"}
          </h1>
        </div>
        <button
          id="timer-view-summary-btn"
          onClick={() => { setIsRunning(false); setShowSummary(true); }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-ink-muted hover:text-ink bg-surface-sunken border border-edge rounded-xl cursor-pointer"
        >
          <Award size={13} /> Recap
        </button>
      </div>

      {/* ── COCKPIT CARD ───────────────────────────────────────── */}
      <div className="relative bg-surface-sunken border border-edge rounded-3xl overflow-hidden card-shadow">
        <AnimatePresence>
          {pendingAction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-4"
            >
              <AlertCircle size={28} className="text-warn animate-pulse" />
              <h3 className="text-lg font-bold text-ink font-fredoka">Reset focus progress?</h3>
              <p className="text-xs text-ink-muted max-w-sm">Loading a new mission will discard your active countdown.</p>
              <div className="flex gap-2 w-full max-w-xs">
                <button
                  id="confirm-action-yes-btn"
                  onClick={() => executeAction(pendingAction)}
                  className="flex-1 py-2.5 bg-danger text-white font-bold text-xs rounded-xl cursor-pointer"
                >Yes, switch</button>
                <button
                  id="confirm-action-no-btn"
                  onClick={() => setPendingAction(null)}
                  className="flex-1 py-2.5 bg-surface-raised text-ink-muted font-bold text-xs rounded-xl cursor-pointer border border-edge"
                >Keep going</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* mission strip */}
        <div className="px-5 sm:px-8 pt-6 pb-4 border-b border-edge-soft">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand mb-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-brand ${isRunning ? "animate-pulse" : ""}`} />
            {isRunning ? "One thing, right now" : "Mission"}
          </div>
          <AnimatePresence mode="wait">
            {currentMission ? (
              <motion.h2
                key={currentMission}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-lg sm:text-2xl font-fredoka font-bold text-ink leading-tight break-words"
              >
                {currentMission}
              </motion.h2>
            ) : (
              <motion.form
                key="quick"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleCreateTempMission}
                className="flex items-center gap-2"
              >
                <input
                  id="quick-focus-input"
                  type="text"
                  value={tempFocusTitle}
                  onChange={(e) => setTempFocusTitle(e.target.value)}
                  placeholder="What's the one thing?"
                  className="flex-1 min-w-0 bg-transparent outline-none text-lg sm:text-xl font-fredoka font-bold text-ink placeholder:text-ink-muted/60"
                />
                <button
                  id="load-quick-focus-btn"
                  type="submit"
                  className="shrink-0 p-2.5 bg-brand hover:bg-brand-hover text-primary-foreground rounded-xl cursor-pointer"
                >
                  <Plus size={16} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* MEGA TIMER: typographic, not a ring */}
        <div className="px-5 sm:px-8 py-8 sm:py-10 text-center relative">
          <div
            role="timer"
            aria-live="polite"
            aria-label={`${formatTime(timeLeft)} remaining, ${status}`}
            className="font-mono font-bold tabular-nums leading-none tracking-tight select-none transition-colors duration-700"
            style={{
              fontSize: "clamp(4.5rem, 18vw, 9rem)",
              color: zoneColor,
              textShadow: isRunning ? `0 0 40px ${zoneColor}55` : "none",
            }}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-success animate-pulse" : status === "paused" ? "bg-warn" : "bg-ink-muted"}`} />
              {status}
            </span>
            <span className="text-ink-muted/40">·</span>
            <span>{donePct}%</span>
            <span className="text-ink-muted/40">·</span>
            <span>{Math.floor(duration / 60)}m goal</span>
          </div>
        </div>

        {/* THIN LINEAR PROGRESS */}
        <div className="h-1 w-full bg-surface/50 relative overflow-hidden">
          <motion.div
            className="h-full absolute inset-y-0 left-0"
            style={{ backgroundColor: zoneColor, boxShadow: `0 0 12px ${zoneColor}` }}
            animate={{ width: `${donePct}%` }}
            transition={{ duration: 0.6, ease: "linear" }}
          />
        </div>

        {/* CONTROL DECK */}
        <div className="px-5 sm:px-8 py-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            id="timer-play-pause-btn"
            onClick={handleStartPause}
            aria-label={isRunning ? "Pause" : "Start"}
            className={`h-14 min-w-[140px] px-6 flex items-center justify-center gap-2 rounded-2xl font-bold text-sm text-primary-foreground transition-all active:scale-95 cursor-pointer ${
              isRunning ? "bg-warn hover:opacity-90" : "bg-brand hover:bg-brand-hover"
            }`}
            style={{ boxShadow: isRunning ? "none" : "var(--theme-glow)" }}
          >
            {isRunning ? <><Pause size={18} className="fill-current" /> Pause</> : <><Play size={18} className="fill-current" /> {status === "paused" ? "Resume" : "Start"}</>}
          </button>

          <button
            id="timer-reset-btn"
            onClick={handleReset}
            className="h-14 w-14 flex items-center justify-center bg-surface hover:bg-surface-raised border border-edge rounded-2xl text-ink-muted transition-colors cursor-pointer"
            title="Reset"
          >
            <RotateCcw size={16} />
          </button>

          {currentMission && (
            <button
              id="timer-complete-btn"
              onClick={handleCompleteMission}
              className="h-14 px-4 flex items-center gap-1.5 bg-success-soft hover:bg-success/20 border border-success/30 text-success font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              title="Finish mission"
            >
              <CheckCircle size={16} /> Done
            </button>
          )}
        </div>

        {/* SENSORY TOGGLES */}
        <div className="px-5 sm:px-8 pb-5 flex flex-wrap items-center justify-center gap-2">
          <button
            id="sound-fx-toggle"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              soundEnabled ? "bg-brand-soft/30 border-brand/30 text-ink" : "bg-surface border-edge-soft text-ink-muted hover:text-ink"
            }`}
          >
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />} Chimes
          </button>
          <button
            id="body-double-pacing-toggle"
            onClick={() => setPacingEnabled(!pacingEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              pacingEnabled ? "bg-brand-soft/30 border-brand/30 text-ink" : "bg-surface border-edge-soft text-ink-muted hover:text-ink"
            }`}
          >
            🎯 Body-double tick
          </button>
        </div>
      </div>

      {/* ── QUEST PICKER (when no mission) ─────────────────────── */}
      {!currentMission && tasks.filter(t => !t.completed).length > 0 && (
        <div className="mt-5 bg-surface-sunken border border-edge rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Or pick a quest</div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {tasks.filter(t => !t.completed).map(task => (
              <button
                key={task.id}
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
                className="text-xs font-semibold text-ink-muted hover:text-ink bg-surface border border-edge-soft hover:border-brand/40 rounded-lg px-2.5 py-1.5 transition-all cursor-pointer truncate max-w-[240px]"
              >
                🎯 {task.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TODAY STRIP ────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="relative bg-surface-sunken border border-edge rounded-2xl p-4 overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-brand" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
            <Clock size={11} /> Focused today
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-ink tabular-nums mt-1">
            {formatFocusDuration(sessionFocusSeconds)}
          </div>
          {activeSessionSeconds > 0 && activeSessionSeconds < 600 && (
            <div className="text-[10px] font-bold text-brand mt-1">
              ⏳ Run: {Math.floor(activeSessionSeconds / 60)}m {activeSessionSeconds % 60}s / 10m
            </div>
          )}
          {activeSessionSeconds >= 600 && (
            <div className="text-[10px] font-bold text-success mt-1">✅ Current run counted</div>
          )}
        </div>
        <div className="relative bg-surface-sunken border border-edge rounded-2xl p-4 overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-success" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
            <CheckSquare size={11} /> Cleared today
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold text-ink tabular-nums mt-1">
            {completedMissions.length}
          </div>
        </div>
      </div>

      {/* ── 10-MIN NOTICE ──────────────────────────────────────── */}
      <div className="mt-3 text-[10px] text-ink-muted font-semibold flex items-center gap-1.5 px-3 py-2 bg-surface-sunken border border-edge-soft rounded-xl">
        <span>🦉</span>
        <span>Only sessions <strong className="text-ink">≥ 10 min</strong> are counted — deep flow gets the credit.</span>
      </div>

      {/* ── COMPLETED CHIPS ────────────────────────────────────── */}
      {completedMissions.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">Cleared today</div>
          <div className="flex flex-wrap gap-1.5">
            {completedMissions.map((title, i) => (
              <span
                key={`${i}-${title}`}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-success-soft border border-success/30 text-success px-2.5 py-1 rounded-lg"
              >
                <CheckCircle size={10} />
                <span className="truncate max-w-[180px]">{title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* progress-in-mission trophy strip */}
      {currentMission && (
        <div className="mt-4 flex items-center gap-2.5 bg-brand-soft/15 border border-brand/20 rounded-xl px-3 py-2.5">
          <Trophy size={14} className="text-brand shrink-0" />
          <span className="text-xs font-semibold text-ink">
            Finish this to auto-clear it from your Quest Log.
          </span>
        </div>
      )}
    </div>
  );
}
