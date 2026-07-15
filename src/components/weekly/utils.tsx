import React from "react";
import type { Task } from "../../types";
import { MONTHS, TimeBlockKey } from "./constants";

/**
 * Returns the Monday of the week that contains the given date.
 * ISO week convention: Sunday is treated as the last day of the previous week.
 */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Sunday (0) → back to previous Monday (-6); otherwise back to this week's Monday.
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date;
}

/**
 * Classifies a task into a time-of-day bucket based on `scheduledTime`.
 * Falls back to "anytime" for missing / malformed values.
 */
export function getTaskTimeBlock(task: Task): TimeBlockKey {
  if (!task.scheduledTime) return "anytime";
  const [hourStr] = task.scheduledTime.split(":");
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return "anytime";
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "anytime";
}

/**
 * Renders inline *italic* markdown (single-asterisk pairs) into React nodes.
 * Non-italic runs are returned as plain strings.
 */
export function parseItalicMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

/**
 * Human-readable label for a week that may cross a month or year boundary.
 * Examples: "July 2026", "July – August 2026", "December 2026 – January 2027".
 */
export function formatWeekHeader(start: Date, end: Date): string {
  if (start.getFullYear() !== end.getFullYear()) {
    return `${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${MONTHS[start.getMonth()]} – ${MONTHS[end.getMonth()]} ${start.getFullYear()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
}

/**
 * Generates an id that's stable enough for local task creation.
 * Uses `crypto.randomUUID` when available, falls back to timestamp + random.
 */
export function generateLocalTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
