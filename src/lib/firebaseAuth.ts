import {
  signInWithPopup,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebaseApp";
import { TOKEN_TTL_MS } from "./constants";

// Firebase App / Auth / Firestore are initialized once in ./firebaseApp so the
// default app always exists before any getAuth()/getFirestore() call.
export { auth };

// A single Google provider that requests BOTH identity and Google Calendar
// access. One sign-in connects the account and the calendar together.
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");

// ─── Calendar access-token storage (independent of the Firebase session) ───
// The id-token keeps the user signed in across reloads; the short-lived
// Calendar access token is what actually talks to the Calendar API. We keep it
// IN MEMORY ONLY: the token carries Google Calendar scopes, and writing it to
// localStorage would let any XSS exfiltrate it and read/modify the user's
// calendar. It lives for the session and is refreshed via the connect/re-auth
// popup when it expires (see connectGoogleCalendar), so a reload just asks the
// user to reconnect Calendar rather than leaking a long-lived secret.
let cachedAccessToken: string | null = null;
let cachedExpiry = 0;

const getStoredToken = (): string | null =>
  cachedAccessToken && cachedExpiry > Date.now() ? cachedAccessToken : null;

const storeToken = (token: string): void => {
  cachedAccessToken = token;
  cachedExpiry = Date.now() + TOKEN_TTL_MS;
};

const clearStoredToken = (): void => {
  cachedAccessToken = null;
  cachedExpiry = 0;
};

/**
 * Start listening to auth state. Unlike the old API, this reports the signed-in
 * user even when no (or an expired) Calendar token is present, and only falls
 * back to `onSignOut` when there is truly no Firebase user.
 */
export const initAuth = (
  onUser?: (user: User, calendarToken: string | null) => void,
  onSignOut?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const currentToken = getStoredToken();
      cachedAccessToken = currentToken;
      if (onUser) onUser(user, currentToken);
    } else {
      cachedAccessToken = null;
      clearStoredToken();
      if (onSignOut) onSignOut();
    }
  });
};

/**
 * Single sign-in: authenticates the Google account AND requests Calendar access
 * in one popup, so the user gets both identity and calendar in a single login.
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Calendar access token.");
    }

    cachedAccessToken = credential.accessToken;
    storeToken(cachedAccessToken);

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Firebase Google Sign-in Error:", error);
    throw error;
  }
};

/**
 * (Re)connect Google Calendar by refreshing the access token. Used when the
 * Calendar token has expired but the user is still signed in — it re-prompts
 * only for Calendar consent, not a full re-login. If no session exists it falls
 * back to a full sign-in (which also grants Calendar).
 */
export const connectGoogleCalendar = async (): Promise<string> => {
  try {
    let result;
    if (auth.currentUser) {
      result = await reauthenticateWithPopup(auth.currentUser, googleProvider);
    } else {
      result = await signInWithPopup(auth, googleProvider);
    }
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Calendar access token.");
    }

    cachedAccessToken = credential.accessToken;
    storeToken(cachedAccessToken);

    return cachedAccessToken;
  } catch (error: any) {
    console.error("Google Calendar (re)connect error:", error);
    throw error;
  }
};

/** Disconnect Calendar only — keeps the account signed in. */
export const clearCalendarToken = (): void => {
  cachedAccessToken = null;
  clearStoredToken();
};

/** Full sign out of the account (also drops the Calendar token). */
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  clearStoredToken();
};
