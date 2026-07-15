// Focus session history & streak stats — persisted in localStorage.
// A "session" is any completed focus/break/pomodoro/breathing run worth logging.

export type SessionMode = "focus" | "break" | "pomodoro" | "breathe";

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  title: string;
  seconds: number; // elapsed time in that session
  at: number; // ms epoch when session ended
}

const KEY = "momentum_focus_history";
const MAX_ENTRIES = 300;

export function loadHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is SessionRecord =>
        r && typeof r.id === "string" && typeof r.seconds === "number" && typeof r.at === "number"
    );
  } catch {
    return [];
  }
}

export function saveHistory(history: SessionRecord[]): void {
  if (typeof window === "undefined") return;
  const trimmed = history.slice(-MAX_ENTRIES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota */ }
}

export function appendSession(record: Omit<SessionRecord, "id" | "at"> & { at?: number }): SessionRecord[] {
  const history = loadHistory();
  const rec: SessionRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: record.at ?? Date.now(),
    mode: record.mode,
    title: record.title,
    seconds: record.seconds,
  };
  const next = [...history, rec];
  saveHistory(next);
  return next;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return dayKey(Date.now());
}

/** Consecutive days (ending today or yesterday) with any counted focus session ≥10min. */
export function computeStreak(history: SessionRecord[]): number {
  const counted = new Set(
    history
      .filter((r) => (r.mode === "focus" || r.mode === "pomodoro") && r.seconds >= 600)
      .map((r) => dayKey(r.at))
  );
  if (counted.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Allow streak to still count today if user hasn't focused yet — start from
  // yesterday when today is empty so a streak isn't "broken" mid-morning.
  const startsToday = counted.has(dayKey(today.getTime()));
  const cursor = new Date(today);
  if (!startsToday) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (counted.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface FocusStats {
  streak: number;
  totalFocusSeconds: number;
  totalSessions: number;
  todayFocusSeconds: number;
  todaySessions: number;
  bestDaySeconds: number;
}

export function computeStats(history: SessionRecord[]): FocusStats {
  const perDay = new Map<string, number>();
  let totalFocusSeconds = 0;
  let totalSessions = 0;
  let todayFocusSeconds = 0;
  let todaySessions = 0;
  const today = todayKey();

  for (const r of history) {
    if (r.mode !== "focus" && r.mode !== "pomodoro") continue;
    totalFocusSeconds += r.seconds;
    totalSessions += 1;
    const k = dayKey(r.at);
    perDay.set(k, (perDay.get(k) ?? 0) + r.seconds);
    if (k === today) {
      todayFocusSeconds += r.seconds;
      todaySessions += 1;
    }
  }

  let bestDaySeconds = 0;
  for (const v of perDay.values()) if (v > bestDaySeconds) bestDaySeconds = v;

  return {
    streak: computeStreak(history),
    totalFocusSeconds,
    totalSessions,
    todayFocusSeconds,
    todaySessions,
    bestDaySeconds,
  };
}

export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
