export type PendingAction = { type: "quest" | "quick_focus"; value: string };
export type TimerMode = "focus" | "pomodoro" | "break";

export type DurationSettings = {
  focusMinutes: number;
  breakMinutes: number;
  pomoFocusMinutes: number;
  pomoBreakMinutes: number;
};

export const DEFAULT_SETTINGS: DurationSettings = {
  focusMinutes: 50,
  breakMinutes: 5,
  pomoFocusMinutes: 25,
  pomoBreakMinutes: 5,
};

export const SETTINGS_KEY = "goblin_focus_settings_v1";

export const MONO_FONT =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const BODY_FONT = "'Work Sans', system-ui, sans-serif";

export function clampMin(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const loadSettings = (): DurationSettings => {
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

export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatTime = (secs: number) => {
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
};

export const formatFocusDuration = (totalSeconds: number) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m ${secs}s`;
};

export const getGubbyResponse = (seconds: number, tasksCount: number) => {
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
