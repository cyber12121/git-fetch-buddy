import { CalendarEvent } from "../types";
import { toLocalDateKey } from "./constants";

/** Minimal shape of a Google Calendar API event we consume. */
interface GoogleCalendarApiItem {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Fetch events from the primary Google Calendar for a date range.
 * Converts Google Calendar API events into our application's CalendarEvent type.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string, // ISO string (e.g., "2026-06-01T00:00:00Z")
  timeMax: string  // ISO string (e.g., "2026-07-31T23:59:59Z")
): Promise<CalendarEvent[]> {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { items?: GoogleCalendarApiItem[] };
    const items: GoogleCalendarApiItem[] = data.items ?? [];

    return items
      .map<CalendarEvent | null>((item) => {
        let eventDate = "";
        let eventTime: string | undefined = undefined;

        if (item.start?.dateTime) {
          // e.g., "2026-07-01T14:30:00-07:00" -> date "2026-07-01", time "14:30"
          const dt = item.start.dateTime;
          eventDate = dt.substring(0, 10);
          eventTime = dt.substring(11, 16);
        } else if (item.start?.date) {
          // All-day event, e.g., "2026-07-01"
          eventDate = item.start.date;
        } else {
          // Guard: Google can return items with neither dateTime nor date
          // (e.g. cancelled recurring instances). Skip instead of crashing.
          return null;
        }

        return {
          id: `google-${item.id}`,
          title: item.summary || "(No Title)",
          date: eventDate,
          time: eventTime,
          color: "bg-sky-50 text-sky-950 border-sky-200 border-l-2 border-l-sky-500 rounded-md px-1.5 shadow-xs",
          type: "google"
        };
      })
      .filter((evt): evt is CalendarEvent => evt !== null);
  } catch (error) {
    console.error("Failed to fetch Google Calendar events:", error);
    throw error;
  }
}

/**
 * Create an event on the user's primary Google Calendar.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  title: string,
  date: string, // YYYY-MM-DD
  time?: string // HH:MM (optional)
): Promise<any> {
  try {
    const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    
    let startObj: any = {};
    let endObj: any = {};

    if (time) {
      // Specific time event
      const startDateTime = `${date}T${time}:00`;

      // Calculate 1 hour later using real date arithmetic (handles day rollover)
      const [h, m] = time.split(":");
      const start = new Date(`${date}T${h}:${m}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const endDate = toLocalDateKey(end);
      const endTime = `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
      const endDateTime = `${endDate}T${endTime}:00`;

      startObj = { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      endObj = { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    } else {
      // All-day event
      startObj = { date: date };
      
      // Calculate next day (exclusive for Google Calendar all-day events)
      const d = new Date(date + "T00:00:00");
      d.setDate(d.getDate() + 1);
      const nextDayStr = toLocalDateKey(d);
      
      endObj = { date: nextDayStr };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: title,
        start: startObj,
        end: endObj,
        description: "Created via Momentum ✨"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Google Calendar event: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    throw error;
  }
}

/**
 * Delete an event from the user's primary Google Calendar.
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string // This should be the raw Google ID (strip our "google-" prefix first!)
): Promise<void> {
  try {
    const rawId = googleEventId.startsWith("google-") ? googleEventId.replace("google-", "") : googleEventId;
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${rawId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 410) { // 410 means already deleted
      const errorText = await response.text();
      throw new Error(`Failed to delete Google Calendar event: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Error deleting Google Calendar event:", error);
    throw error;
  }
}
