import { useMemo } from "react";
import { Task, CalendarEvent } from "../../types";
import { cleanString } from "../../lib/text";
import type { FilterType } from "./constants";

export function useCalendarEvents(
  tasks: Task[],
  manualEvents: CalendarEvent[],
  googleEvents: CalendarEvent[],
  filterType: FilterType
): Record<string, CalendarEvent[]> {
  return useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    const add = (dayString: string, evt: CalendarEvent) => {
      (map[dayString] ||= []).push(evt);
    };

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
          const rawId = evt.id.replace(/^google-/, "");
          const isLinkedToTask = tasks.some(t => t.googleEventId === rawId);
          if (isLinkedToTask) return;

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

    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    });

    return map;
  }, [tasks, manualEvents, googleEvents, filterType]);
}
