import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { CalendarEvent } from "../types";
import {
  initAuth,
  signInWithGoogle,
  connectGoogleCalendar,
  clearCalendarToken,
  logout,
} from "../lib/firebaseAuth";
import { fetchGoogleCalendarEvents } from "../lib/googleCalendar";
import { cleanString } from "../lib/text";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface UseGoogleCalendarArgs {
  selectedDate: string;
  onMessage: (msg: string, mood: GubbyMood) => void;
  setManualEvents: (updater: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
}

/**
 * Owns the Google identity + Calendar session: the Firebase auth listener,
 * the connect/disconnect/sign-out handlers, and loading Calendar events
 * (including reconciliation of locally-created manual events).
 */
export function useGoogleCalendar({ selectedDate, onMessage, setManualEvents }: UseGoogleCalendarArgs) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Keep the latest selected date available to the (stable) load callback.
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const loadGoogleEvents = useCallback(
    async (token: string) => {
      setIsLoadingGoogle(true);
      setGoogleError(null);
      try {
        // Parse the YYYY-MM-DD selected date as LOCAL midnight so the
        // ±45/90-day window aligns with the same local-time interpretation
        // used a few lines down when filtering manual events. `new Date("YYYY-MM-DD")`
        // alone parses as UTC midnight and shifts the window by up to a day
        // in negative-offset timezones, mis-filtering boundary events.
        const baseDate = new Date(selectedDateRef.current + "T00:00:00");
        const timeMinDate = new Date(baseDate.getTime() - 45 * 24 * 60 * 60 * 1000);
        const timeMaxDate = new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000);
        const timeMin = timeMinDate.toISOString();
        const timeMax = timeMaxDate.toISOString();
        const evts = await fetchGoogleCalendarEvents(token, timeMin, timeMax);
        setGoogleEvents(evts);

        // Reconcile manualEvents:
        // 1. Retroactively link any manual events to Google Calendar events if
        //    they match by title and date.
        // 2. Drop a manual event that was deleted on Google Calendar (within range).
        setManualEvents((prevEvents) => {
          let changed = false;

          const updated = prevEvents.map((evt) => {
            if (!evt.googleEventId) {
              const match = evts.find(
                (gEvt) => gEvt.date === evt.date && cleanString(gEvt.title) === cleanString(evt.title)
              );
              if (match) {
                const rawId = match.id.replace(/^google-/, "");
                changed = true;
                return { ...evt, googleEventId: rawId };
              }
            }
            return evt;
          });

          const filtered = updated.filter((evt) => {
            if (!evt.googleEventId) return true;
            const evtDate = new Date(evt.date + "T00:00:00");
            if (evtDate >= timeMinDate && evtDate <= timeMaxDate) {
              const existsInGoogle = evts.some((gEvt) => gEvt.id === `google-${evt.googleEventId}`);
              if (!existsInGoogle) {
                changed = true;
                return false;
              }
            }
            return true;
          });

          if (changed) {
            try {
              localStorage.setItem("goblin_events", JSON.stringify(filtered));
            } catch {
              /* ignore quota errors */
            }
          }
          return filtered;
        });
      } catch (err: unknown) {
        console.error("Error loading Google events:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("401") || errMsg.includes("403")) {
          // Token expired — drop it but KEEP the account + cloud sync alive.
          clearCalendarToken();
          setAccessToken(null);
          setGoogleEvents([]);
          setGoogleError("Your Google Calendar connection expired. Please reconnect.");
          onMessage("Your Google Calendar connection expired. Reconnect to sync events — your account data is safe! 🍄", "thoughtful");
        } else {
          setGoogleError(errMsg || "Failed to load Google Calendar events.");
        }
      } finally {
        setIsLoadingGoogle(false);
      }
    },
    [onMessage, setManualEvents]
  );

  const handleConnectGoogle = useCallback(async () => {
    setIsLoadingGoogle(true);
    setGoogleError(null);
    try {
      let token: string;
      if (user) {
        // Already signed in — reconnect Calendar only (no full re-login).
        token = await connectGoogleCalendar();
      } else {
        const res = await signInWithGoogle();
        token = res.accessToken;
        setUser(res.user);
      }
      setAccessToken(token);
      onMessage("Connected to Google Calendar! 📅 Let's explore your events together!", "happy");
    } catch (err: unknown) {
      console.error("Failed to connect Google Calendar:", err);
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
      let msg = err instanceof Error ? err.message : "Google connection failed.";
      if (code === "auth/popup-blocked") msg = "Popup was blocked. Please allow popups for this site and try again.";
      else if (code === "auth/popup-closed-by-user") msg = "Sign-in popup was closed. Please try again.";
      else if (code === "auth/unauthorized-domain") msg = "This domain is not authorized in Firebase. Add it to Firebase Console → Authentication → Authorized Domains.";
      setGoogleError(msg);
      onMessage(`Connection failed: ${msg} 🍄`, "thoughtful");
    } finally {
      setIsLoadingGoogle(false);
    }
  }, [user, onMessage]);

  const handleDisconnectGoogle = useCallback(async () => {
    // Disconnect Calendar only — keep the account + cloud sync alive.
    clearCalendarToken();
    setAccessToken(null);
    setGoogleEvents([]);
    onMessage("Google Calendar disconnected. Your account and quests stay safe in the cloud! ☁️", "cozy");
  }, [onMessage]);

  const handleSignOut = useCallback(async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setGoogleEvents([]);
    onMessage("Signed out. Your quests are safe in local storage — see you soon! 🍂", "cozy");
  }, [onMessage]);

  // Listen to auth state.
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Reload events when the token changes. Consumers (CalendarModule) drive
  // range-based refetches themselves on month navigation — depending on
  // selectedDate here too would double-fetch on the same tab.
  useEffect(() => {
    if (accessToken) {
      void loadGoogleEvents(accessToken);
    } else {
      setGoogleEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return {
    user,
    accessToken,
    googleEvents,
    isLoadingGoogle,
    googleError,
    setIsLoadingGoogle,
    loadGoogleEvents,
    handleConnectGoogle,
    handleDisconnectGoogle,
    handleSignOut,
  };
}
