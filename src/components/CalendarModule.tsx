import { useState, useEffect, useCallback, useMemo } from "react";
import { Task, CalendarEvent } from "../types";
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "../lib/googleCalendar";
import { User } from "firebase/auth";
import { cleanString } from "../lib/text";
import { toLocalDateKey } from "../lib/constants";
import { MONTHS, COLORS, FilterType, CreateType } from "./calendar/constants";
import { useCalendarEvents } from "./calendar/useCalendarEvents";
import GoogleSyncBar from "./calendar/GoogleSyncBar";
import CalendarToolbar from "./calendar/CalendarToolbar";
import MonthGrid from "./calendar/MonthGrid";
import MobileAgenda from "./calendar/MobileAgenda";
import CreateItemModal from "./calendar/CreateItemModal";
import EventDetailsModal from "./calendar/EventDetailsModal";

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
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const isAnyLoading = isLoadingGoogle || isLoadingAction;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateType>("task");
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventColor, setEventColor] = useState(COLORS[0].value);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDateExpanded = useCallback((dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reload Google Calendar events on range/token changes
  useEffect(() => {
    if (accessToken) {
      onLoadGoogleEvents(accessToken);
    }
  }, [accessToken, year, month, onLoadGoogleEvents]);

  // Escape-to-close for whichever modal is open
  useEffect(() => {
    if (!isCreateOpen && !selectedEvent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isCreateOpen) setIsCreateOpen(false);
      else if (selectedEvent) setSelectedEvent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCreateOpen, selectedEvent]);

  const eventsByDay = useCalendarEvents(tasks, manualEvents, googleEvents, filterType);

  const formatDateString = useCallback((day: number) => {
    const mm = (month + 1).toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }, [year, month]);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
    onGubbyMessage(`Travelling back to ${MONTHS[(month - 1 + 12) % 12]}! 🍂`, "cozy");
  }, [year, month, onGubbyMessage]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
    onGubbyMessage(`Sailing forward to ${MONTHS[(month + 1) % 12]}! 🍃`, "cozy");
  }, [year, month, onGubbyMessage]);

  const handleJumpToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(toLocalDateKey(now));
    onGubbyMessage("Jumping back to today! 🌟🍄", "happy");
  }, [onSelectDate, onGubbyMessage]);

  const handleFilterChange = useCallback((f: FilterType) => {
    setFilterType(f);
    if (f === "all") onGubbyMessage("Displaying all tasks & custom events on the calendar! 🌟", "cozy");
    else if (f === "task") onGubbyMessage("Scheduler filtered to show Task Quests only! 🎯", "focused");
    else onGubbyMessage("Scheduler filtered to show custom Events only! 📌", "happy");
  }, [onGubbyMessage]);

  const openCreateFor = useCallback((dayStr: string) => {
    onSelectDate(dayStr);
    setSelectedDateStr(dayStr);
    if (filterType === "task") {
      setCreateType("task");
      onGubbyMessage(`Creating a new Task Quest for ${dayStr}! 🎯`, "focused");
    } else if (filterType === "event") {
      setCreateType("event");
      onGubbyMessage(`Planning a custom calendar event for ${dayStr}! 📌`, "happy");
    } else {
      setCreateType("task");
      onGubbyMessage(`Planning a quest or custom event for ${dayStr}! What's the goal? 🌟`, "thoughtful");
    }
    setTaskTitle("");
    setTaskPriority("medium");
    setEventTitle("");
    setEventTime("");
    setEventColor(COLORS[0].value);
    setIsCreateOpen(true);
  }, [filterType, onSelectDate, onGubbyMessage]);

  const handleCellSelect = useCallback((day: number) => {
    openCreateFor(formatDateString(day));
  }, [formatDateString, openCreateFor]);

  const handleOpenAddFor = useCallback((d: Date) => {
    const key = toLocalDateKey(d);
    if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    openCreateFor(key);
  }, [currentDate, openCreateFor]);

  const handleSaveItem = useCallback(async (e: React.FormEvent) => {
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
          if (gEvent && gEvent.id) googleEventId = gEvent.id;
          await onLoadGoogleEvents(accessToken);
          onGubbyMessage(`Custom Event "${eventTitle.trim()}" successfully saved locally & synchronized to Google Calendar! 📅✨`, "happy");
        } catch (err: unknown) {
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
  }, [createType, taskTitle, taskPriority, eventTitle, eventTime, eventColor, selectedDateStr, accessToken, onAddTask, onAddManualEvent, onLoadGoogleEvents, onGubbyMessage]);

  const handleEventClick = useCallback((e: React.SyntheticEvent, evt: CalendarEvent) => {
    e.stopPropagation();
    setSelectedEvent(evt);
    onGubbyMessage(`Inspecting: "${evt.title}"`, "cozy");
  }, [onGubbyMessage]);

  const handleDeleteEvent = useCallback(async (id: string) => {
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
        const matchingManual = manualEvents.find(evt => evt.googleEventId === rawGoogleId);
        if (matchingManual) onDeleteManualEvent(matchingManual.id);
        setSelectedEvent(null);
        onGubbyMessage("Google Calendar event deleted successfully! 🗑️", "cozy");
      } catch (err: unknown) {
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
  }, [tasks, manualEvents, googleEvents, accessToken, selectedEvent, onDeleteTask, onDeleteManualEvent, onLoadGoogleEvents, onGubbyMessage]);

  const handleFocusFromCalendar = useCallback((evt: CalendarEvent) => {
    setSelectedEvent(null);
    onFocusTask(evt.title, undefined, evt.taskId ?? evt.id);
  }, [onFocusTask]);

  const handleConnectGoogle = useCallback(() => { void onConnectGoogle(); }, [onConnectGoogle]);
  const handleDisconnectGoogle = useCallback(() => { void onDisconnectGoogle(); }, [onDisconnectGoogle]);
  const handleSignOut = useCallback(() => { void onSignOut(); }, [onSignOut]);

  return (
    <div id="calendar-module" className="w-full px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
      <GoogleSyncBar
        user={user}
        calendarConnected={calendarConnected}
        isAnyLoading={isAnyLoading}
        googleError={googleError}
        onConnect={handleConnectGoogle}
        onDisconnect={handleDisconnectGoogle}
        onSignOut={handleSignOut}
      />

      <div className="bg-surface p-6 rounded-3xl border-2 border-edge card-shadow">
        <CalendarToolbar
          year={year}
          month={month}
          filterType={filterType}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onJumpToday={handleJumpToday}
          onFilterChange={handleFilterChange}
        />

        <MonthGrid
          year={year}
          month={month}
          todayDate={today}
          selectedDate={selectedDate}
          filterType={filterType}
          eventsByDay={eventsByDay}
          expandedDates={expandedDates}
          onToggleExpanded={toggleDateExpanded}
          onCellSelect={handleCellSelect}
          onEventClick={handleEventClick}
        />

        <MobileAgenda
          selectedDate={selectedDate}
          currentDate={currentDate}
          eventsByDay={eventsByDay}
          onSelectDate={onSelectDate}
          onSetCurrentDate={setCurrentDate}
          onOpenAddFor={handleOpenAddFor}
          onEventClick={handleEventClick}
        />
      </div>

      <CreateItemModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        selectedDateStr={selectedDateStr}
        createType={createType}
        onSetCreateType={setCreateType}
        taskTitle={taskTitle}
        onSetTaskTitle={setTaskTitle}
        taskPriority={taskPriority}
        onSetTaskPriority={setTaskPriority}
        eventTitle={eventTitle}
        onSetEventTitle={setEventTitle}
        eventTime={eventTime}
        onSetEventTime={setEventTime}
        eventColor={eventColor}
        onSetEventColor={setEventColor}
        hasGoogleToken={!!accessToken}
        isLoading={isAnyLoading}
        onSubmit={handleSaveItem}
      />

      <EventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
        onFocus={handleFocusFromCalendar}
      />
    </div>
  );
}
