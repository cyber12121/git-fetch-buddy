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
      onGubbyMessage("Paused! Take a deep breath, roll your shoulders. Gubby is waiting here.", "cozy");
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

  if (showSummary) {
    return (
      <div id="taskmaster-summary-module" className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface p-8 rounded-3xl border-2 border-[#FFD4A3] card-shadow text-center space-y-6 relative overflow-hidden"
        >
          {/* Sparkles / Confetti Background elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-[#F27D26] to-orange-600"></div>
          
          <div className="space-y-2">
            <div className="inline-flex p-3 bg-amber-50 rounded-2xl text-brand border border-amber-200">
              <Award size={36} className="animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold text-ink font-fredoka tracking-tight">
              Focus Session Accomplished!
            </h1>
            <p className="text-sm text-ink-muted font-semibold">
              You did a magnificent job. Here's a look at your brain-power stats! ⚡
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
            <div className="bg-surface-sunken border-2 border-edge-soft p-5 rounded-2xl flex flex-col items-center justify-center space-y-1">
              <Clock size={20} className="text-brand" />
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Total Focused Time</span>
              <span className="text-2xl font-extrabold text-ink font-fredoka">
                {formatFocusDuration(sessionFocusSeconds)}
              </span>
            </div>
            <div className="bg-surface-sunken border-2 border-edge-soft p-5 rounded-2xl flex flex-col items-center justify-center space-y-1">
              <CheckSquare size={20} className="text-green-600" />
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Quests Cleared</span>
              <span className="text-2xl font-extrabold text-ink font-fredoka">
                {completedMissions.length}
              </span>
            </div>
          </div>

          {/* Completed List */}
          <div className="max-w-lg mx-auto bg-surface-sunken border-2 border-edge-soft rounded-2xl p-5 text-left space-y-3">
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5 border-b border-edge pb-2">
              <Zap size={14} className="text-amber-500" /> Completed Quests
            </h3>
            {completedMissions.length > 0 ? (
              <ul className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {completedMissions.map((title, index) => (
                  <motion.li
                    key={`${index}-${title}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2.5 text-sm font-semibold text-ink"
                  >
                    <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                    <span>{title}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-muted font-semibold italic text-center py-2">
                No quests fully marked complete this session, but your dedicated focus time is an incredible win! Keep building that momentum! 🌱
              </p>
            )}
          </div>

          {/* Gubby Feedback Box */}
          <div className="max-w-lg mx-auto bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-left items-center">
            <div className="text-3xl select-none shrink-0">🦉</div>
            <p className="text-xs font-semibold text-amber-950 font-nunito leading-relaxed">
              <strong>Gubby says:</strong> {getGubbyResponse(sessionFocusSeconds, completedMissions.length)}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              id="summary-back-btn"
              onClick={() => setShowSummary(false)}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow transition-all active:scale-[0.98] cursor-pointer"
            >
              Back to Timer
            </button>
            <button
              id="summary-reset-session-btn"
              onClick={() => {
                if (window.confirm("Are you sure you want to reset all focus stats for today? 🦉")) {
                  handleStartNewSession();
                }
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-surface-raised hover:bg-surface-raised2 text-stone-600 font-bold text-sm rounded-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              Reset Today's Progress
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="taskmaster-module" className="max-w-2xl mx-auto space-y-6">
      
      {/* Distraction-Free Focus Arena */}
      <div className="bg-surface p-8 rounded-3xl border-2 border-edge card-shadow text-center space-y-6 relative overflow-hidden">
        
        {/* Elegant Overlap Confirmation for Active Session Protection */}
        <AnimatePresence>
          {pendingAction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface/95 z-30 flex flex-col items-center justify-center p-6 text-center space-y-4"
            >
              <div className="p-3 bg-amber-50 rounded-2xl text-brand border border-amber-200">
                <AlertCircle size={32} className="animate-bounce" />
              </div>
              <h3 className="text-xl font-extrabold text-ink font-fredoka">
                Reset Focus Progress?
              </h3>
              <p className="text-xs font-bold text-ink-muted max-w-sm font-nunito leading-relaxed">
                You are currently in the middle of a focus run! Changing this will discard your active countdown progress. Are you sure you want to proceed? 🦉
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 w-full max-w-xs">
                <button
                  id="confirm-action-yes-btn"
                  onClick={() => executeAction(pendingAction)}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Yes, Reset & Switch
                </button>
                <button
                  id="confirm-action-no-btn"
                  onClick={() => {
                    setPendingAction(null);
                    onGubbyMessage("Decision saved! Let's resume focus. 🦉💪", "focused");
                  }}
                  className="flex-1 px-4 py-2.5 bg-surface-raised hover:bg-surface-raised2 text-stone-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  No, Keep Going
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle Background Radial Ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-[#FFD4A3]/10 pointer-events-none select-none"></div>

        <div className="space-y-1">
          <span className="text-xs font-bold text-brand uppercase tracking-widest block">
            🚀 Your mission, should you choose to accept it:
          </span>
          
          <AnimatePresence mode="wait">
            {currentMission ? (
              <motion.h1
                key={currentMission}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="text-3xl md:text-4xl font-extrabold text-ink font-fredoka leading-snug tracking-tight max-w-xl mx-auto"
              >
                {currentMission}
              </motion.h1>
            ) : (
              <motion.div
                key="empty-mission"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-4 space-y-4"
              >
                <p className="text-ink-muted font-bold text-lg font-fredoka">No focus mission loaded yet!</p>
                
                {/* Pick existing tasks or type a quick one */}
                <form onSubmit={handleCreateTempMission} className="max-w-md mx-auto flex items-center gap-2">
                  <input
                    id="quick-focus-input"
                    type="text"
                    value={tempFocusTitle}
                    onChange={(e) => setTempFocusTitle(e.target.value)}
                    placeholder="Type a quick thing to focus on right now..."
                    aria-label="Type a quick focus mission to load"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft focus:border-brand focus:bg-surface outline-none font-semibold text-sm text-ink-2"
                  />
                  <button
                    id="load-quick-focus-btn"
                    type="submit"
                    className="p-3 bg-brand hover:bg-brand-hover text-white rounded-xl shadow font-bold text-sm"
                    title="Load quick mission"
                  >
                    <Plus size={16} />
                  </button>
                </form>

                {tasks.length > 0 && (
                  <div className="space-y-2 max-w-md mx-auto">
                    <p className="text-xs text-ink-muted font-bold uppercase tracking-wider">Or pick an existing quest:</p>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto bg-surface-sunken p-2 rounded-xl border-2 border-edge-soft">
                      {tasks.filter(t => !t.completed).map(task => (
                        <button
                          key={task.id}
                          id={`quick-pick-task-${task.id}`}
                          onClick={() => {
                            const hasProgress = timeLeft < duration && timeLeft > 0;
                            if (hasProgress) {
                              setPendingAction({ type: "quest", value: task.title });
                              setIsRunning(false);
                              onGubbyMessage("Hold on! Loading a new quest will reset your current timer's progress. Are you sure? 🦉❓", "thoughtful");
                            } else {
                              setCurrentMission(task.title);
                              setTimeLeft(duration);
                              setIsRunning(false);
                              setActiveSessionSeconds(0);
                              onGubbyMessage(`Loaded task: "${task.title}". Let's crush this!`, "focused");
                            }
                          }}
                          className="text-xs text-left text-ink-muted hover:text-ink hover:bg-brand-soft/20 px-2.5 py-1.5 rounded-lg font-semibold transition-colors truncate"
                        >
                          🎯 {task.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SVG Radial Ring Timer — visual time representation for ADHD time blindness */}
        <div className="flex flex-col items-center gap-3">
          {(() => {
            const size = 220;
            const stroke = 14;
            const r = (size - stroke) / 2;
            const circ = 2 * Math.PI * r;
            const remaining = duration > 0 ? timeLeft / duration : 1;
            const dashOffset = circ * (1 - remaining);
            const pct = 1 - remaining;
            // Color shifts based on how much time is left
            const ringColor = remaining <= 0.1 ? "#ef4444" : remaining <= 0.2 ? "#f59e0b" : "#4ade80";
            const ringGlowColor = remaining <= 0.1 ? "rgba(239,68,68,0.3)" : remaining <= 0.2 ? "rgba(245,158,11,0.25)" : "rgba(74,222,128,0.2)";
            return (
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                  {/* Background ring */}
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E6EEE6" strokeWidth={stroke} />
                  {/* Progress ring */}
                  <circle
                    cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={ringColor} strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 0.8s linear, stroke 1s ease", filter: `drop-shadow(0 0 6px ${ringGlowColor})` }}
                  />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <div className={`text-4xl font-extrabold font-fredoka tabular-nums select-none transition-colors duration-1000 ${remaining <= 0.1 ? "text-red-500" : remaining <= 0.2 ? "text-amber-500" : "text-ink "}`}>
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                    {isRunning ? "focusing..." : timeLeft === duration ? "ready" : "paused"}
                  </div>
                  {duration > 0 && (
                    <div className="text-[11px] font-bold text-ink-muted mt-0.5">
                      {Math.round(pct * 100)}% done
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Pause / Play */}
          <button
            id="timer-play-pause-btn"
            onClick={handleStartPause}
            aria-label={isRunning ? "Pause focus timer" : "Start focus timer"}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg transition-all active:scale-[0.95] cursor-pointer ${
              isRunning
                ? "bg-green-600 hover:bg-green-700"
                : "bg-brand hover:bg-brand-hover"
            }`}
          >
            {isRunning ? <Pause size={28} className="fill-white" /> : <Play size={28} className="fill-white ml-1" />}
          </button>

          {/* Reset */}
          <button
            id="timer-reset-btn"
            onClick={handleReset}
            className="w-12 h-12 bg-surface-raised hover:bg-surface-raised2 text-stone-600 rounded-full flex items-center justify-center shadow-sm transition-all"
            title="Reset Timer"
          >
            <RotateCcw size={18} />
          </button>

          {/* Complete early */}
          {currentMission && (
            <button
              id="timer-complete-btn"
              onClick={handleCompleteMission}
              className="w-12 h-12 bg-green-50 hover:bg-green-100 text-green-700 rounded-full flex items-center justify-center shadow-sm transition-all cursor-pointer"
              title="Finish Mission!"
            >
              <CheckCircle size={18} />
            </button>
          )}

          {/* View Today's Milestones / Summary */}
          <button
            id="timer-view-summary-btn"
            onClick={() => {
              setIsRunning(false);
              setShowSummary(true);
              onGubbyMessage("Let's review your focus milestones! Celebrate every second of effort! 🏆", "happy");
            }}
            className="w-12 h-12 bg-amber-50 hover:bg-amber-100 text-brand rounded-full flex items-center justify-center shadow-sm transition-all cursor-pointer"
            title="View Daily Milestones"
          >
            <Award size={18} className="text-brand" />
          </button>
        </div>

        {/* Sensory and Assistive Settings */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs text-ink-muted">
          {/* Sound FX */}
          <button
            id="sound-fx-toggle"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              onGubbyMessage(soundEnabled ? "Chimes muted!" : "Chimes unmuted!", "happy");
            }}
            className="flex items-center gap-1 hover:text-ink"
          >
            {soundEnabled ? <Volume2 size={14} className="text-brand" /> : <VolumeX size={14} />}
            <span>Timer Sound {soundEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Body Double Click */}
          <button
            id="body-double-pacing-toggle"
            onClick={() => {
              const val = !pacingEnabled;
              setPacingEnabled(val);
              onGubbyMessage(val ? "Ticking feedback enabled! Like a rhythmic clock companion." : "Ticking feedback disabled.", "happy");
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 transition-all ${
              pacingEnabled 
                ? "bg-brand-soft  text-orange-900 border-brand/30 font-bold" 
                : "hover:text-ink  border-transparent"
            }`}
          >
            🎯 <span>Body Double Ticking: {pacingEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Completion Trophy Card */}
      {currentMission && (
        <div className="bg-brand-soft/10 border-2 border-edge p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 bg-brand-soft text-orange-900 rounded-xl">
            <Trophy size={20} />
          </div>
          <div className="flex-1 text-sm font-semibold text-orange-900">
            Work in progress! Finish this mission to clear it from your Magic To-Do master list automatically!
          </div>
        </div>
      )}

      {/* Live Active Stats Banner directly below the Taskmaster Arena - always visible for daily progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface p-5 rounded-2xl border-2 border-edge-soft card-shadow space-y-3"
      >
        <div className="flex items-center justify-between border-b border-edge pb-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-brand animate-pulse" />
            <h3 className="text-sm font-extrabold text-ink font-fredoka">
              Today's Focus Milestones
            </h3>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
            Daily Progress
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-surface-sunken p-3 rounded-xl border border-edge">
            <Clock size={16} className="text-brand shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider truncate">Total Focused Today</span>
              <span className="text-sm font-extrabold text-ink font-fredoka">
                {formatFocusDuration(sessionFocusSeconds)}
              </span>
              {activeSessionSeconds > 0 && activeSessionSeconds < 600 && (
                <span className="text-[9px] font-extrabold text-brand animate-pulse mt-0.5" title="Focus sessions must reach 10 minutes to be saved. Keep going!">
                  ⏳ Run: {Math.floor(activeSessionSeconds / 60)}m {activeSessionSeconds % 60}s / 10m
                </span>
              )}
              {activeSessionSeconds >= 600 && (
                <span className="text-[9px] font-extrabold text-green-600 mt-0.5">
                  ✅ Current run counted!
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-surface-sunken p-3 rounded-xl border border-edge">
            <CheckSquare size={16} className="text-green-600 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider truncate">Quests Completed Today</span>
              <span className="text-sm font-extrabold text-ink font-fredoka">
                {completedMissions.length} {completedMissions.length === 1 ? "Quest" : "Quests"}
              </span>
            </div>
          </div>
        </div>

        {/* Info notice about ADHD 10-min filter */}
        <div className="text-[10px] text-ink-muted/90 font-semibold bg-surface border border-edge px-3 py-2 rounded-xl flex items-center gap-1.5 leading-relaxed">
          <span>🦉</span>
          <span>Only focus sessions <strong>10 minutes or longer</strong> are saved and counted towards your daily milestones to encourage deep flow.</span>
        </div>

        {/* Quick inline list of completed tasks today */}
        {completedMissions.length > 0 ? (
          <div className="pt-1.5 space-y-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest block">Completed today:</span>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pt-1">
              {completedMissions.map((title, index) => (
                <span
                  key={`${index}-${title}`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#F0FDF4] text-green-700 border border-green-200/60 px-2.5 py-1 rounded-lg"
                >
                  <CheckCircle size={10} className="text-green-600" />
                  <span className="truncate max-w-[150px]">{title}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-ink-muted font-semibold italic pt-1">
            No focus tasks completed today yet. Start a quest above to build your daily streak! 🌱
          </p>
        )}
      </motion.div>

    </div>
  );
}
