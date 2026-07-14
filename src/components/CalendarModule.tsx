import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2, Check, Play, AlertCircle, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Task, CalendarEvent } from "../types";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "../lib/googleCalendar";
import { User } from "firebase/auth";
import { cleanString } from "../lib/text";
import { toLocalDateKey, PRIORITY_SOLID } from "../lib/constants";

interface CalendarModuleProps {
  tasks: Task[];
  manualEvents: CalendarEvent[];
  onAddManualEvent: (event: Omit<CalendarEvent, "id">) => void;
  onDeleteManualEvent: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onGubbyMessage: (msg: string, mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited") => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onAddTask: (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string) => void;
  googleEvents: CalendarEvent[];
  isLoadingGoogle: boolean;
  googleError: string | null;
  user: User | null;
  accessToken: string | null;
  calendarConnected: boolean;
  onConnectGoogle: () => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onLoadGoogleEvents: (token: string) => Promise<void>;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLORS = [
  { value: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Leaf Green 🍃" },
  { value: "bg-amber-100 text-amber-800 border-amber-200", label: "Sweet Amber 🍊" },
  { value: "bg-sky-100 text-sky-800 border-sky-200", label: "Sky Blue 🌊" },
  { value: "bg-purple-100 text-purple-800 border-purple-200", label: "Berry Purple 🍇" }
];

export default function CalendarModule({
  tasks,
  manualEvents,
  onAddManualEvent,
  onDeleteManualEvent,
  onDeleteTask,
  onFocusTask,
  onGubbyMessage,
  selectedDate,
  onSelectDate,
  onAddTask,
  googleEvents,
  isLoadingGoogle,
  googleError,
  user,
  accessToken,
  calendarConnected,
  onConnectGoogle,
  onDisconnectGoogle,
  onSignOut,
  onLoadGoogleEvents
}: CalendarModuleProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const isAnyLoading = isLoadingGoogle || isLoadingAction;

  // Create Event / Task Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"task" | "event">("task");
  const [selectedDateStr, setSelectedDateStr] = useState("");
  
  // Custom Task states
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");

  // Custom Event states
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventColor, setEventColor] = useState(COLORS[0].value);
  
  // Selected Event Detail Overlay State
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Switch display between all, tasks only, or events only
  const [filterType, setFilterType] = useState<"all" | "task" | "event">("all");

  // Days whose event list is expanded past the visible cap (reveals hidden
  // events instead of hiding them behind an invisible scroll area).
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDateExpanded = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reload Google Calendar events on range/token changes
  useEffect(() => {
    if (accessToken) {
      onLoadGoogleEvents(accessToken);
    }
  }, [accessToken, year, month, onLoadGoogleEvents]);

  // Refs for moving focus into an open modal
  const createModalRef = useRef<HTMLDivElement>(null);
  const detailsModalRef = useRef<HTMLDivElement>(null);

  // Escape-to-close + initial focus for whichever modal is open
  useEffect(() => {
    if (!isCreateOpen && !selectedEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isCreateOpen) {
        setIsCreateOpen(false);
      } else if (selectedEvent) {
        setSelectedEvent(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreateOpen, selectedEvent]);

  useEffect(() => {
    if (isCreateOpen) createModalRef.current?.focus();
  }, [isCreateOpen]);

  useEffect(() => {
    if (selectedEvent) detailsModalRef.current?.focus();
  }, [selectedEvent]);

  const handleConnectGoogle = async () => {
    await onConnectGoogle();
  };

  const handleDisconnectGoogle = async () => {
    await onDisconnectGoogle();
  };

  const handleSignOut = async () => {
    await onSignOut();
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    onGubbyMessage(`Travelling back to ${MONTHS[(month - 1 + 12) % 12]}! 🍂`, "cozy");
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    onGubbyMessage(`Sailing forward to ${MONTHS[(month + 1) % 12]}! 🍃`, "cozy");
  };

  // Convert day number to YYYY-MM-DD string
  const formatDateString = (day: number) => {
    const mm = (month + 1).toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // Helper to compare event and task titles without emojis, prefixes, or formatting differences
  // Aggregate tasks scheduled for dates + manual events + Google events
  // Aggregate tasks scheduled for dates + manual events + Google events.
  // Memoized so the per-day lookup doesn't recompute/re-sort on every cell render.
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    const add = (dayString: string, evt: CalendarEvent) => {
      (map[dayString] ||= []).push(evt);
    };

    // 1. Plot Scheduled Tasks
    if (filterType === "all" || filterType === "task") {
      tasks.forEach(task => {
        if (task.scheduledDate) {
          add(task.scheduledDate, {
            id: `task-event-${task.id}`,
            title: task.title,
            date: task.scheduledDate,
            time: task.scheduledTime,
            color: task.completed
              ? "bg-surface  text-ink-muted border-edge-soft/60 line-through rounded-md px-1.5"
              : task.priority === "high"
              ? "bg-orange-50/70 text-orange-950 border-orange-200 border-l-2 border-l-[#F27D26] rounded-r-md rounded-l-xs px-1.5"
              : "bg-emerald-50/70 text-emerald-950 border-emerald-200 border-l-2 border-l-emerald-600 rounded-r-md rounded-l-xs px-1.5",
            type: "task",
            taskId: task.id
          });
        }
      });
    }

    // 2. Plot Manual & Google Events
    if (filterType === "all" || filterType === "event") {
      const addedTitlesAndDates = new Set<string>();

      manualEvents.forEach(evt => {
        if (evt.date) {
          add(evt.date, {
            ...evt,
            color: `${evt.color} rounded-full px-2 shadow-xs border`
          });
          addedTitlesAndDates.add(`${cleanString(evt.title)}-${evt.date}`);
        }
      });

      googleEvents.forEach(evt => {
        if (evt.date) {
          // Check if this Google event is linked to any task by id or title
          const rawId = evt.id.replace(/^google-/, "");
          const isLinkedToTask = tasks.some(t => t.googleEventId === rawId);
          if (isLinkedToTask) return;

          // Robust name-based deduplication using cleanString helper
          const isSameTitleAsTask = tasks.some(t =>
            t.scheduledDate === evt.date && cleanString(t.title) === cleanString(evt.title)
          );
          if (isSameTitleAsTask) return;

          const key = `${cleanString(evt.title)}-${evt.date}`;
          if (!addedTitlesAndDates.has(key)) {
            add(evt.date, evt);
          }
        }
      });
    }

    // Sort each day's events by time (mutating the memoized arrays is safe here)
    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    });

    return map;
  }, [tasks, manualEvents, googleEvents, filterType]);

  const getEventsForDay = (dayString: string) => eventsByDay[dayString] || [];

  const handleCellSelect = (day: number) => {
    const dayStr = formatDateString(day);
    onSelectDate(dayStr);
    setSelectedDateStr(dayStr);
    
    // Auto-select form type based on calendar filter
    if (filterType === "task") {
      setCreateType("task");
      onGubbyMessage(`Creating a new Task Quest for ${dayStr}! 🎯`, "focused");
    } else if (filterType === "event") {
      setCreateType("event");
      onGubbyMessage(`Planning a custom calendar event for ${dayStr}! 📌`, "happy");
    } else {
      setCreateType("task"); // Default to task creation for general All view
      onGubbyMessage(`Planning a quest or custom event for ${dayStr}! What's the goal? 🌟`, "thoughtful");
    }

    // Reset inputs
    setTaskTitle("");
    setTaskPriority("medium");
    setEventTitle("");
    setEventTime("");
    setEventColor(COLORS[0].value);
    setIsCreateOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createType === "task") {
      if (!taskTitle.trim()) return;
      onAddTask(taskTitle.trim(), taskPriority, undefined, selectedDateStr);
      setIsCreateOpen(false);
      onGubbyMessage(`Task Quest "${taskTitle.trim()}" scheduled for ${selectedDateStr}! 🎯`, "happy");
    } else {
      if (!eventTitle.trim()) return;
      
      let googleEventId: string | undefined = undefined;

      if (accessToken) {
        setIsLoadingAction(true);
        try {
          const gEvent = await createGoogleCalendarEvent(accessToken, eventTitle.trim(), selectedDateStr, eventTime || undefined);
          if (gEvent && gEvent.id) {
            googleEventId = gEvent.id;
          }
          await onLoadGoogleEvents(accessToken);
          onGubbyMessage(`Custom Event "${eventTitle.trim()}" successfully saved locally & synchronized to Google Calendar! 📅✨`, "happy");
        } catch (err: any) {
          console.error("Failed to save to Google Calendar", err);
          onGubbyMessage(`Saved event locally, but Google Calendar synchronization failed. 📌`, "thoughtful");
        } finally {
          setIsLoadingAction(false);
        }
      } else {
        onGubbyMessage(`Custom Event "${eventTitle.trim()}" pinned to ${selectedDateStr}! 📌`, "happy");
      }

      onAddManualEvent({
        title: eventTitle.trim(),
        date: selectedDateStr,
        time: eventTime || undefined,
        color: eventColor,
        type: "manual",
        googleEventId
      });

      setIsCreateOpen(false);
    }
  };

  const handleEventClick = (e: React.SyntheticEvent, evt: CalendarEvent) => {
    e.stopPropagation(); // prevent triggering day cell selection
    setSelectedEvent(evt);
    onGubbyMessage(`Inspecting: "${evt.title}"`, "cozy");
  };

  const handleDeleteEvent = async (id: string) => {
    if (id.startsWith("google-")) {
      const rawGoogleId = id.replace("google-", "");
      const linkedTask = tasks.find(t => t.googleEventId === rawGoogleId);

      if (linkedTask) {
        onDeleteTask(linkedTask.id);
        setSelectedEvent(null);
        onGubbyMessage("Google Calendar event and linked task deleted successfully! 🗑️", "cozy");
        return;
      }

      if (!accessToken) {
        setSelectedEvent(null);
        onGubbyMessage("Unable to delete Google Calendar event without an active Google connection. 📌", "thoughtful");
        return;
      }

      setIsLoadingAction(true);
      try {
        await deleteGoogleCalendarEvent(accessToken, id);
        await onLoadGoogleEvents(accessToken);
        
        // ALSO find and delete any local manual event linked to this Google event (by stored id)
        const matchingManual = manualEvents.find(evt => evt.googleEventId === rawGoogleId);
        if (matchingManual) {
          onDeleteManualEvent(matchingManual.id);
        }

        setSelectedEvent(null);
        onGubbyMessage("Google Calendar event deleted successfully! 🗑️", "cozy");
      } catch (err: any) {
        console.error("Failed to delete Google Calendar event", err);
        onGubbyMessage("Oops! Could not delete event from Google Calendar.", "thoughtful");
      } finally {
        setIsLoadingAction(false);
      }
    } else if (id.startsWith("task-event-")) {
      const taskId = id.replace("task-event-", "");
      onDeleteTask(taskId);
      setSelectedEvent(null);
      onGubbyMessage("Goblin quest banished! Begone, task clutter! 🗑️", "cozy");
    } else {
      onDeleteManualEvent(id);

      // ALSO delete from Google Calendar if connected and the event was synced there
      if (accessToken && selectedEvent) {
        const googleId = selectedEvent.googleEventId;
        if (googleId) {
          setIsLoadingAction(true);
          try {
            await deleteGoogleCalendarEvent(accessToken, googleId);
            await onLoadGoogleEvents(accessToken);
          } catch (err) {
            console.error("Failed to delete synced Google event", err);
          } finally {
            setIsLoadingAction(false);
          }
        } else {
          // Fall back to a fragile title+date match only when no stored id exists
          const matchingGoogle = googleEvents.find(
            evt => cleanString(evt.title) === cleanString(selectedEvent.title) && evt.date === selectedEvent.date
          );
          if (matchingGoogle) {
            setIsLoadingAction(true);
            try {
              await deleteGoogleCalendarEvent(accessToken, matchingGoogle.id);
              await onLoadGoogleEvents(accessToken);
            } catch (err) {
              console.error("Failed to delete matching Google event", err);
            } finally {
              setIsLoadingAction(false);
            }
          }
        }
      }

      setSelectedEvent(null);
      onGubbyMessage("Goblin event erased!", "cozy");
    }
  };

  const handleFocusFromCalendar = (evt: CalendarEvent) => {
    setSelectedEvent(null);
    onFocusTask(evt.title, undefined, evt.taskId ?? evt.id);
  };

  // Render Days grid
  const renderCalendarCells = () => {
    const cells = [];
    
    // Empty cells for padding of the first week
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(
        <div key={`empty-${i}`} className="aspect-square md:aspect-auto md:min-h-[110px] bg-surface/40 border border-edge/50 rounded-lg"></div>
      );
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateString(day);
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const isSelected = dateStr === selectedDate;
      const dayEvents = getEventsForDay(dateStr);
      const expanded = expandedDates.has(dateStr);

      cells.push(
        <div
          key={`day-${day}`}
          role="button"
          tabIndex={0}
          aria-label={`Select day ${day} of ${MONTHS[month]} ${year}`}
          onClick={() => handleCellSelect(day)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleCellSelect(day);
            }
          }}
          className={`aspect-square md:aspect-auto md:min-h-[110px] p-0.5 md:p-1 border rounded-lg md:rounded-xl transition-all cursor-pointer flex flex-col items-stretch group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${expanded ? "relative z-10" : ""} ${
            isToday
              ? "ring-2 ring-[#F27D26] ring-offset-2 border-orange-200 bg-orange-50/20 shadow-[0_0_12px_rgba(242,125,38,0.35)]"
              : isSelected
              ? "border-brand bg-brand-soft/15 ring-2 ring-[#F27D26]/20 shadow-xs"
              : "border-edge  bg-surface  hover:bg-brand-soft/5"
          }`}
        >
          {/* Day number header */}
          <div className="flex justify-between items-center md:px-1">
            <span className={`text-[11px] md:text-xs font-bold font-fredoka ${isToday ? "text-white bg-brand rounded-full w-5 h-5 flex items-center justify-center" : "text-ink-muted "}`}>
              {day}
            </span>
            <button
              id={`add-btn-${day}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCellSelect(day);
              }}
              className="hidden md:inline-block opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[9px] md:text-[10px] font-extrabold text-white bg-brand hover:bg-brand-hover px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
            >
              {filterType === "task" ? "+ Task 🎯" : filterType === "event" ? "+ Event 📌" : "+ Add 🌟"}
            </button>
          </div>

          {/* Mobile-only event dot indicators */}
          {dayEvents.length > 0 && (
            <div className="flex md:hidden items-end justify-center gap-0.5 flex-1 pb-1">
              {dayEvents.slice(0, 3).map((evt) => (
                <span
                  key={`dot-${evt.id}`}
                  className={`w-1.5 h-1.5 rounded-full border ${evt.color}`}
                  aria-hidden="true"
                />
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[8px] font-bold text-ink-muted leading-none ml-0.5">+{dayEvents.length - 3}</span>
              )}
            </div>
          )}

          {/* Desktop event stack */}
          <div className="hidden md:flex flex-col flex-1 min-h-0">


          {/* Events Stack */}
          {(() => {
            const MAX_VISIBLE = 3;
            const visibleEvents = expanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE);
            const hiddenCount = dayEvents.length - visibleEvents.length;
            return (
              <div className={`mt-1 space-y-1 flex-1 pr-0.5 ${expanded ? "" : "max-h-[70px] overflow-hidden"}`}>
                {visibleEvents.map((evt) => (
                  <div
                    key={evt.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleEventClick(e, evt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleEventClick(e, evt);
                      }
                    }}
                    className={`text-[10px] font-bold py-1 px-1.5 border truncate hover:scale-[1.02] transition-transform select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${evt.color}`}
                    title={`${evt.time ? `[${evt.time}] ` : ""}${evt.title}`}
                  >
                    {evt.time && <span className="font-mono text-[9px] mr-0.5 opacity-80">{evt.time}</span>}
                    {evt.type === "task" ? "🎯 " : "📌 "}{evt.title}
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDateExpanded(dateStr);
                    }}
                    className="w-full text-left text-[10px] font-bold text-brand bg-brand-soft/40 hover:bg-brand-soft/60 px-1.5 py-1 rounded truncate cursor-pointer transition-colors"
                  >
                    +{hiddenCount} more
                  </button>
                )}
                {expanded && dayEvents.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDateExpanded(dateStr);
                    }}
                    className="w-full text-left text-[10px] font-bold text-ink-muted hover:text-ink px-1.5 py-1 rounded truncate cursor-pointer transition-colors"
                  >
                    Show less
                  </button>
                )}
              </div>
            );
          })()}
          </div>
        </div>

      );
    }

    return cells;
  };

  return (
    <div id="calendar-module" className="w-full px-6 py-6 space-y-6">

      {/* Google Calendar Connection Status Bar */}
      <div className="bg-surface p-4 rounded-3xl border-2 border-edge card-shadow flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📅</div>
          <div>
            <h3 className="text-sm font-bold text-ink font-fredoka flex items-center gap-2">
              Google Calendar Sync
              {calendarConnected ? (
                <span className="text-[10px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold">
                  Connected
                </span>
              ) : (
                <span className="text-[10px] bg-surface-raised text-ink-muted px-2.5 py-0.5 rounded-full font-bold">
                  {user ? "Account only" : "Disconnected"}
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-muted">
              {!user
                ? "Sign in with Google to sync your data and bring real events onto your cozy map."
                : calendarConnected
                  ? `Calendar syncing automatically as ${user.email || "your account"}!`
                  : `Signed in as ${user.email || "your account"}. Connect Google Calendar to see your real events here.`}
            </p>
          </div>
        </div>

        <div>
          {calendarConnected ? (
            <div className="flex items-center gap-3">
              {isAnyLoading && (
                <span className="text-xs text-ink-muted animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-brand rounded-full animate-ping"></span>
                  Syncing...
                </span>
              )}
              <button
                id="disconnect-google-btn"
                onClick={handleDisconnectGoogle}
                disabled={isAnyLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold font-fredoka cursor-pointer transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={13} />
                Disconnect
              </button>
              <button
                id="signout-google-btn"
                onClick={handleSignOut}
                disabled={isAnyLoading}
                className="text-[11px] font-semibold text-ink-muted hover:text-stone-600 underline-offset-2 hover:underline cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              id="connect-google-btn"
              onClick={handleConnectGoogle}
              disabled={isAnyLoading}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents" style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {user ? "Connect Google Calendar" : "Sign in & Connect Calendar"}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Google Auth Error */}
      {googleError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-2xl flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
      
      {/* Calendar Header with Navigation */}
      <div className="bg-surface p-6 rounded-3xl border-2 border-edge card-shadow">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-edge">
          <div>
            <h2 className="text-2xl font-bold text-ink font-fredoka flex items-center gap-2">
              📅 Calendar
            </h2>
            <p className="text-sm text-ink-muted">Scheduled tasks auto-appear here. Click any day to add a task or event.</p>
          </div>

          <div className="flex flex-col sm:items-end gap-2.5 self-center sm:self-auto w-full sm:w-auto">
            {/* Month Nav */}
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-surface-sunken p-1.5 rounded-2xl border-2 border-edge-soft w-full sm:w-auto">
              <button
                id="prev-month-btn"
                onClick={handlePrevMonth}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-brand-soft/20 rounded-xl transition-all cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm md:text-base font-bold text-ink font-fredoka min-w-[120px] text-center select-none">
                {MONTHS[month]} {year}
              </span>
              <button
                id="next-month-btn"
                onClick={handleNextMonth}
                className="p-1.5 text-ink-muted hover:text-ink hover:bg-brand-soft/20 rounded-xl transition-all cursor-pointer"
              >
                <ChevronRight size={18} />
              </button>
              
              {/* Today jump button */}
              <button
                id="today-month-btn"
                onClick={() => {
                  const now = new Date();
                  setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  onSelectDate(toLocalDateKey(now));
                  onGubbyMessage("Jumping back to today! 🌟🍄", "happy");
                }}
                className="px-2.5 py-1 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition-all cursor-pointer select-none"
              >
                Today
              </button>
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-edge-soft self-center sm:self-end w-full sm:w-auto justify-around sm:justify-start">
              <button
                id="filter-all-btn"
                onClick={() => {
                  setFilterType("all");
                  onGubbyMessage("Displaying all tasks & custom events on the calendar! 🌟", "cozy");
                }}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold font-fredoka transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-brand text-white shadow-xs"
                    : "text-ink-muted  hover:text-ink  hover:bg-surface-raised/50"
                }`}
              >
                🌟 All
              </button>
              <button
                id="filter-tasks-btn"
                onClick={() => {
                  setFilterType("task");
                  onGubbyMessage("Scheduler filtered to show Task Quests only! 🎯", "focused");
                }}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold font-fredoka transition-all cursor-pointer ${
                  filterType === "task"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-ink-muted  hover:text-ink  hover:bg-surface-raised/50"
                }`}
              >
                🎯 Tasks
              </button>
              <button
                id="filter-events-btn"
                onClick={() => {
                  setFilterType("event");
                  onGubbyMessage("Scheduler filtered to show custom Events only! 📌", "happy");
                }}
                className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold font-fredoka transition-all cursor-pointer ${
                  filterType === "event"
                    ? "bg-brand-hover text-white shadow-xs"
                    : "text-ink-muted  hover:text-ink  hover:bg-surface-raised/50"
                }`}
              >
                📌 Events
              </button>
            </div>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1.5 mt-4 text-center">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="text-xs font-bold text-ink-muted py-1 font-fredoka uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Monthly Grid */}
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {renderCalendarCells()}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-edge text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-100 rounded-full border border-emerald-200"></span>
            <span>Task Quests</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-100 rounded-full border border-amber-200"></span>
            <span>Manual Events</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-50 rounded-full border border-sky-200"></span>
            <span>Google Calendar Events</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-surface-raised rounded-full border border-edge-soft"></span>
            <span>Completed Quests</span>
          </div>
        </div>
      </div>

      {/* Pop-up Modals: A. Create Event */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              ref={createModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-modal-title"
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-6 rounded-3xl border-2 border-edge max-w-md w-full shadow-2xl space-y-4 outline-none"
            >
              <h3 id="create-modal-title" className="text-xl font-bold text-ink font-fredoka flex items-center gap-2">
                <Plus size={22} className="text-brand" /> Plan for {selectedDateStr}
              </h3>

              {/* Tab Switcher inside Modal */}
              <div className="flex bg-surface-sunken p-1 rounded-xl border border-edge-soft">
                <button
                  type="button"
                  id="modal-tab-task"
                  onClick={() => {
                    setCreateType("task");
                    onGubbyMessage("Let's add a structured Task Quest! 🎯", "focused");
                  }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold font-fredoka rounded-lg transition-all cursor-pointer ${
                    createType === "task"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-ink-muted  hover:text-ink  hover:bg-surface "
                  }`}
                >
                  🎯 Task Quest
                </button>
                <button
                  type="button"
                  id="modal-tab-event"
                  onClick={() => {
                    setCreateType("event");
                    onGubbyMessage("Let's pin a custom calendar Event! 📌", "happy");
                  }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold font-fredoka rounded-lg transition-all cursor-pointer ${
                    createType === "event"
                      ? "bg-brand-hover text-white shadow-xs"
                      : "text-ink-muted  hover:text-ink  hover:bg-surface "
                  }`}
                >
                  📌 Custom Event
                </button>
              </div>
              
              <form onSubmit={handleSaveItem} className="space-y-3.5 font-nunito text-sm">
                
                {createType === "task" ? (
                  /* Task Form */
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink-muted uppercase">Task Title:</label>
                      <input
                        id="new-task-title"
                        type="text"
                        required
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="E.g., Complete math assignment, gather wood..."
                        className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-emerald-600 font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink-muted uppercase block">Quest Priority:</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["low", "medium", "high"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            id={`task-priority-btn-${lvl}`}
                            type="button"
                            onClick={() => setTaskPriority(lvl)}
                            className={`py-2 px-3 rounded-xl border-2 text-xs font-bold font-fredoka uppercase transition-all cursor-pointer text-center ${
                              taskPriority === lvl
                                ? PRIORITY_SOLID[lvl] + " shadow-sm"
                                : "bg-surface  text-ink-muted  border-edge-soft  hover:bg-surface-raised "
                            }`}
                          >
                            {lvl === "high" ? "🔴" : lvl === "medium" ? "🟡" : "🟢"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Custom Event Form */
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink-muted uppercase">Event Title:</label>
                      <input
                        id="new-event-title"
                        type="text"
                        required
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="E.g., Doctor appointment, fetch green moss..."
                        className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-ink-muted uppercase">Time (Optional):</label>
                      <input
                        id="new-event-time"
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-surface-sunken border-2 border-edge-soft outline-none focus:border-brand font-semibold"
                      />
                    </div>

                    {/* Color Preset Picker */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-ink-muted uppercase">Color Theme:</label>
                      <div className="flex gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c.value}
                            id={`event-color-picker-${c.value}`}
                            type="button"
                            onClick={() => setEventColor(c.value)}
                            className={`w-8 h-8 rounded-full border transition-all ${c.value} flex items-center justify-center shrink-0 ${
                              eventColor === c.value ? "ring-2 ring-[#F27D26] scale-105" : "opacity-80"
                            }`}
                            title={c.label}
                          >
                            {eventColor === c.value && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {accessToken && (
                      <div className="bg-sky-50 text-sky-800 text-[11px] font-bold px-3 py-2 rounded-xl border border-sky-100 flex items-center gap-1.5">
                        <span className="text-sm">📅</span>
                        <span>Syncs instantly to your primary Google Calendar!</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center gap-3 pt-3">
                  <button
                    id="cancel-create"
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-2.5 bg-surface-raised hover:bg-surface-raised2 text-ink-muted font-bold rounded-xl text-sm cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-create"
                    type="submit"
                    disabled={isAnyLoading}
                    className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm cursor-pointer transition-colors ${
                      isAnyLoading ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      createType === "task"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-brand hover:bg-brand-hover"
                    }`}
                  >
                    {isAnyLoading ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-surface rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                    ) : createType === "task" 
                      ? "Schedule Quest" 
                      : accessToken 
                        ? "📅 Sync to Google Calendar" 
                        : "Pin Event"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pop-up Modals: B. Event Details Overlay */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              ref={detailsModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="details-modal-title"
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface p-6 rounded-3xl border-2 border-edge max-w-sm w-full shadow-2xl space-y-4 outline-none"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                  Quest Details
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedEvent.color}`}>
                  {selectedEvent.type === "task" ? "To-Do Quest" : selectedEvent.type === "google" ? "Google Calendar" : "Manual Event"}
                </span>
              </div>

              <div className="space-y-2 font-nunito">
                <h4 id="details-modal-title" className="text-xl font-bold text-ink font-fredoka leading-snug">
                  {selectedEvent.type === "task" ? "🎯 " : selectedEvent.type === "google" ? "📅 " : "📌 "}{selectedEvent.title}
                </h4>
                
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  <Clock size={12} />
                  <span>Date: {selectedEvent.date} {selectedEvent.time ? `@ ${selectedEvent.time}` : ""}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {selectedEvent.type === "task" && (
                  <button
                    id="calendar-focus-task-btn"
                    onClick={() => handleFocusFromCalendar(selectedEvent)}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play size={12} /> Focus in Timer 🎯
                  </button>
                )}

                <div className="flex gap-2">
                  {(selectedEvent.type === "manual" || selectedEvent.type === "google" || selectedEvent.type === "task") && (
                    <button
                      id="calendar-delete-event-btn"
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 size={12} /> {selectedEvent.type === "task" ? "Remove Task" : "Remove Event"}
                    </button>
                  )}
                  <button
                    id="calendar-close-details-btn"
                    onClick={() => {
                      setSelectedEvent(null);
                    }}
                    className="flex-1 py-2 bg-surface-raised hover:bg-surface-raised2 text-ink-muted text-xs font-bold rounded-xl transition-colors text-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
