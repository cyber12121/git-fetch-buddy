// Lightweight guest-mode flag. When set, the app skips the auth gate and
// runs entirely from localStorage — no cloud sync, no Google Calendar.
const KEY = "goblinflow.guestMode";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuestMode() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function disableGuestMode() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
