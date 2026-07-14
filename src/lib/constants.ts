// Centralized magic numbers / heuristics so they don't drift across files.

import type { Task } from "../types";

// Google OAuth access tokens are valid for ~1 hour (3600s). We persist with a
// small buffer so we stop using the token just before it actually expires.
export const TOKEN_TTL_MS = 3600 * 1000;

// Per-IP rate limit for the Gemini proxy endpoints.
export const RATE_WINDOW_MS = 60_000; // 1 minute
export const RATE_MAX = 20; // max requests per window per IP
export const MAX_RAW_TEXT_LENGTH = 20_000;

// How long to wait for the upstream Gemini API before aborting (ms).
export const GEMINI_FETCH_TIMEOUT_MS = 30_000;

// Automatic duration estimator for ADHD-friendly tasks (like goblin.tools Estimator).
const DURATION_KEYWORDS: Array<{ words: string[]; minutes: number }> = [
  { words: ["clean", "tidy", "organize", "wash", "vacuum", "laundry", "mop", "heap"], minutes: 30 },
  { words: ["write", "code", "draft", "prepare", "essay", "report", "design", "develop"], minutes: 45 },
  { words: ["call", "email", "message", "reply", "text", "ask", "check"], minutes: 10 },
  { words: ["read", "study", "review", "learn", "watch", "research"], minutes: 20 },
  { words: ["buy", "get", "shop", "order", "grocery"], minutes: 15 },
  { words: ["workout", "exercise", "gym", "run", "walk", "yoga", "meditate"], minutes: 60 },
  { words: ["meet", "meeting", "sync", "discuss", "consult"], minutes: 30 },
  { words: ["pay", "bill", "rent", "bank", "finance"], minutes: 10 },
];

export const DEFAULT_ESTIMATE_MINUTES = 25; // Default pomodoro estimate

// Shared priority color classes so the To-Do badge, Compiler preview, and
// Calendar priority picker all use the same hues (emerald = low, amber =
// medium, orange = high) instead of drifting across modules.
// - PRIORITY_CHIP: soft tinted chips (badges / previews)
// - PRIORITY_SOLID: filled buttons (e.g. Calendar's priority picker)
export const PRIORITY_CHIP: Record<"low" | "medium" | "high", string> = {
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
};

export const PRIORITY_SOLID: Record<"low" | "medium" | "high", string> = {
  low: "bg-emerald-600 text-white border-emerald-600",
  medium: "bg-amber-500 text-white border-amber-500",
  high: "bg-orange-600 text-white border-orange-600",
};

export function estimateTaskDuration(title: string): number {
  const t = title.toLowerCase();
  for (const { words, minutes } of DURATION_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return minutes;
  }
  return DEFAULT_ESTIMATE_MINUTES;
}

export type TaskSize = "small" | "medium" | "large";

/**
 * How "scary" a task feels. Big, unbroken tasks are the ones that trigger
 * ADHD task paralysis, so we flag them so the UI can nudge a breakdown.
 * - Already split into 3+ micro-steps → small (no longer scary).
 * - Has some steps → sized by estimate.
 * - No steps → sized by estimate, with title length as a rough dread signal.
 */
export function getTaskSize(task: Pick<Task, "estimatedMinutes" | "subtasks" | "title">): TaskSize {
  const subs = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
  const mins = task.estimatedMinutes ?? DEFAULT_ESTIMATE_MINUTES;
  const titleLen = task.title ? task.title.length : 0;

  if (subs >= 3) return "small";
  if (subs >= 1) return mins > 60 ? "medium" : "small";

  if (mins >= 60 || titleLen > 45) return "large";
  if (mins >= 30 || titleLen > 28) return "medium";
  return "small";
}

/**
 * Format a Date as a local YYYY-MM-DD key (NOT UTC).
 * Uses the local timezone so "today" matches what the user sees on their
 * calendar, avoiding an off-by-one near midnight in non-UTC zones.
 * Centralized here so every module agrees on the same date key.
 */
export function toLocalDateKey(date: Date = new Date()): string {
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().split("T")[0];
}
