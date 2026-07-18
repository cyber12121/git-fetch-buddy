/**
 * Per-day completion log — records every task/mission the user finishes,
 * independent of the tasks[] array. This survives "Sweep done" (which
 * deletes completed tasks) so today's Recap and the Today dashboard keep
 * showing what was accomplished even after cleanup.
 *
 * Storage: localStorage `momentum_completion_log` = { [YYYY-MM-DD]: entry[] }
 * Only the last 14 days are retained.
 */
import { readJSON, writeJSON } from "./safeStorage";

export interface CompletionEntry {
  /** Unique — task id, or synthetic for ad-hoc missions. */
  id: string;
  title: string;
  at: number; // epoch ms
  /** "task" via checkbox, "focus" via timer, "mission" ad-hoc. */
  source: "task" | "focus" | "mission";
}

type Log = Record<string, CompletionEntry[]>;

const KEY = "momentum_completion_log";
const KEEP_DAYS = 14;

let log: Log | null = null;
const listeners = new Set<(log: Log) => void>();

function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hydrate(): Log {
  if (log) return log;
  const saved = readJSON<Log | null>(KEY, null);
  log = saved && typeof saved === "object" ? saved : {};
  return log;
}

function persist() {
  if (!log) return;
  // Trim to KEEP_DAYS most recent days
  const keys = Object.keys(log).sort();
  if (keys.length > KEEP_DAYS) {
    const trimmed: Log = {};
    for (const k of keys.slice(-KEEP_DAYS)) trimmed[k] = log[k];
    log = trimmed;
  }
  writeJSON(KEY, log);
  for (const fn of listeners) fn(log);
}

export function logCompletion(entry: Omit<CompletionEntry, "at"> & { at?: number }) {
  const l = hydrate();
  const at = entry.at ?? Date.now();
  const key = dayKey(at);
  const arr = l[key] ? [...l[key]] : [];
  // De-dupe on same id within the same day.
  if (arr.some((e) => e.id === entry.id)) return;
  arr.push({ id: entry.id, title: entry.title, at, source: entry.source });
  l[key] = arr;
  persist();
}

export function unlogCompletion(id: string, at: number = Date.now()) {
  const l = hydrate();
  const key = dayKey(at);
  if (!l[key]) return;
  const next = l[key].filter((e) => e.id !== id);
  if (next.length === l[key].length) return;
  l[key] = next;
  persist();
}

export function getCompletionsForDay(iso: string): CompletionEntry[] {
  const l = hydrate();
  return l[iso] ?? [];
}

export function getTodayCompletions(): CompletionEntry[] {
  return getCompletionsForDay(dayKey());
}

export function subscribeCompletionLog(fn: (log: Log) => void): () => void {
  const l = hydrate();
  listeners.add(fn);
  fn(l);
  return () => { listeners.delete(fn); };
}
