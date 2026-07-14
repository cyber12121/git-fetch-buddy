/**
 * Small, defensive wrappers around `localStorage` for JSON payloads.
 *
 * localStorage can throw in real-world conditions:
 *  - private browsing modes disable it entirely
 *  - the storage quota (~5 MB) is exceeded, especially with the habit log
 *  - a stale/corrupted value fails `JSON.parse`
 *  - `localStorage` doesn't exist during SSR
 *
 * Unguarded reads/writes will crash the whole React tree. These helpers
 * swallow errors, log them once, and return a caller-supplied fallback so
 * the app keeps working from in-memory state.
 */

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch (err) {
    console.warn(`[safeStorage] failed to read "${key}":`, err);
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[safeStorage] failed to parse "${key}", clearing:`, err);
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    return fallback;
  }
}

export interface WriteJSONOptions {
  /** Called on write failure (quota exceeded, storage disabled, etc.) */
  onError?: (err: unknown) => void;
}

export function writeJSON(key: string, value: unknown, opts: WriteJSONOptions = {}): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[safeStorage] failed to write "${key}":`, err);
    opts.onError?.(err);
    return false;
  }
}

export function readString(key: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[safeStorage] failed to write "${key}":`, err);
    return false;
  }
}
