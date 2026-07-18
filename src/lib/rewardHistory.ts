/**
 * Tiny pub-sub store for reward events (combos, XP milestones, achievements).
 * Persists the last 50 entries to localStorage so the history survives reloads.
 * Kept intentionally small — ADHD-friendly panels should stay skimmable.
 */
import { readJSON, writeJSON } from "./safeStorage";

export type RewardKind = "combo" | "milestone" | "achievement" | "levelup";

export interface RewardEntry {
  id: number;
  kind: RewardKind;
  icon: string;
  message: string;
  at: number; // epoch ms
}

const KEY = "goblin_reward_history";
const MAX = 50;

let entries: RewardEntry[] = [];
let hydrated = false;
let nextId = 1;
const listeners = new Set<(items: RewardEntry[]) => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const saved = readJSON<RewardEntry[] | null>(KEY, null);
  if (Array.isArray(saved)) {
    entries = saved.slice(0, MAX);
    nextId = entries.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }
}

function emit() {
  for (const fn of listeners) fn(entries);
}

export function recordReward(kind: RewardKind, icon: string, message: string) {
  hydrate();
  const entry: RewardEntry = { id: nextId++, kind, icon, message, at: Date.now() };
  entries = [entry, ...entries].slice(0, MAX);
  writeJSON(KEY, entries);
  emit();
}

export function removeRewardByMessage(message: string) {
  hydrate();
  const idx = entries.findIndex((e) => e.message === message);
  if (idx === -1) return;
  entries = [...entries.slice(0, idx), ...entries.slice(idx + 1)];
  writeJSON(KEY, entries);
  emit();
}

export function getRewardHistory(): RewardEntry[] {
  hydrate();
  return entries;
}

export function clearRewardHistory() {
  entries = [];
  writeJSON(KEY, entries);
  emit();
}

export function subscribeRewardHistory(fn: (items: RewardEntry[]) => void): () => void {
  hydrate();
  listeners.add(fn);
  fn(entries);
  return () => { listeners.delete(fn); };
}
