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

function sanitize(d: Partial<UserData>): UserData {
  return {
    tasks: Array.isArray(d.tasks) ? (d.tasks as Task[]) : [],
    manualEvents: Array.isArray(d.manualEvents) ? (d.manualEvents as CalendarEvent[]) : [],
    habits: Array.isArray(d.habits) ? (d.habits as Habit[]) : [],
    habitLog: (d.habitLog as HabitLog) ?? {},
    xp: typeof d.xp === "number" && d.xp >= 0 ? d.xp : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now(),
    profile: d.profile && typeof d.profile === "object" ? d.profile : undefined,
  };
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
  await setDoc(ref, data, { merge: true });
}
