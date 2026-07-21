// Per-user cloud persistence on top of the already-initialized Firebase app.
// When the user is signed in we mirror the local Goblin Flow state into a single
// Firestore document. When signed out (or if Firestore is unreachable) the app
// keeps using localStorage, so this layer is strictly additive.
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { Task, CalendarEvent, Habit, HabitLog } from "../types";
import { db } from "./firebaseApp";

export interface UserProfile {
  name?: string;
  email?: string;
}

export interface UserData {
  tasks: Task[];
  manualEvents: CalendarEvent[];
  habits: Habit[];
  habitLog: HabitLog;
  xp: number;
  updatedAt: number;
  // Optional human-readable snapshot of the account this doc belongs to.
  // The Firebase `uid` (the document id) remains the true reference key.
  profile?: UserProfile;
}

/**
 * Recursively strip `undefined` values. Firestore's setDoc rejects any
 * undefined field with "Function setDoc() called with invalid data", which
 * happens whenever an optional task field (googleEventId, scheduledDate,
 * notes, …) is missing on some rows.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function sanitize(d: Partial<UserData>): UserData {
  return stripUndefined({
    tasks: Array.isArray(d.tasks) ? (d.tasks as Task[]) : [],
    manualEvents: Array.isArray(d.manualEvents) ? (d.manualEvents as CalendarEvent[]) : [],
    habits: Array.isArray(d.habits) ? (d.habits as Habit[]) : [],
    habitLog: (d.habitLog as HabitLog) ?? {},
    xp: typeof d.xp === "number" && d.xp >= 0 ? d.xp : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
    profile: d.profile && typeof d.profile === "object" ? d.profile : undefined,
  });
}

/** Load a user's saved data. Returns null if they have nothing stored yet. */
export async function loadUserData(uid: string): Promise<UserData | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return sanitize(snap.data() as Partial<UserData>);
}

/** Save (merge) a user's data. Throws on network/permission failure. */
export async function saveUserData(uid: string, data: UserData): Promise<void> {
  const ref = doc(db, "users", uid);
  await setDoc(ref, sanitize(data), { merge: true });
}
