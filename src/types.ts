export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  notes?: string;
  completed: boolean;
  subtasks: SubTask[];
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  createdAt: string;
  color?: string; // Tweek highlight color (e.g. 'yellow', 'green', 'pink', 'blue', 'purple', or undefined)
  googleEventId?: string; // Optional linked Google Calendar event ID
  estimatedMinutes?: number; // Estimated minutes to complete
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  color: string; // Tailwind background class name (e.g., 'bg-amber-100 text-amber-800')
  type: "manual" | "task" | "google";
  taskId?: string; // linked task ID if any
  googleEventId?: string; // Optional linked Google Calendar event ID
}

// --- Habit Tracker Types ---
export interface Habit {
  id: string;
  name: string;
  color: string; // hex color for the chain cells (e.g. "#F27D26")
  createdAt: string; // ISO date string
}

export type HabitDayStatus = "done" | "skip" | "none";

// Keyed by "habitId:YYYY-MM-DD" → status
export type HabitLog = Record<string, HabitDayStatus>;

