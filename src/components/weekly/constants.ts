/**
 * Shared constants for the Weekly Planner module.
 * Kept in a dedicated file so components can import without pulling in JSX.
 */

/** Color pill options a task can be tagged with. `value: ""` = no color. */
export const PILL_COLORS = [
  { name: "None",   value: "",        bg: "",        text: "" },
  { name: "Yellow", value: "yellow",  bg: "#FFF176", text: "#33311a" },
  { name: "Green",  value: "green",   bg: "#69F0AE", text: "#1a3322" },
  { name: "Teal",   value: "teal",    bg: "#80DEEA", text: "#003333" },
  { name: "Pink",   value: "pink",    bg: "#F48FB1", text: "#3d001a" },
  { name: "Purple", value: "purple",  bg: "#CE93D8", text: "#1a003d" },
] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** localStorage key that persists the time-blocks toggle across sessions. */
export const TIME_BLOCKS_STORAGE_KEY = "goblin_weekly_time_blocks";

/** Sentinel dateStr used by the "Someday" backlog column. */
export const SOMEDAY_KEY = "someday";

/** Config for the four time-of-day buckets shown when Time Blocks is ON. */
export type TimeBlockKey = "morning" | "afternoon" | "evening" | "anytime";

export interface TimeBlockConfig {
  key: TimeBlockKey;
  /** HH:MM assigned to tasks dropped/added in this block. undefined = anytime. */
  time: string | undefined;
  label: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
}

export const TIME_BLOCKS: readonly TimeBlockConfig[] = [
  { key: "morning",   time: "09:00", label: "Morning",   emoji: "☀️",  bg: "#FEFCE8", border: "#FEF08A", text: "#A16207" },
  { key: "afternoon", time: "13:00", label: "Afternoon", emoji: "🌤️", bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D" },
  { key: "evening",   time: "18:00", label: "Evening",   emoji: "🌙",  bg: "#FDF4FF", border: "#F5D0FE", text: "#701A75" },
  { key: "anytime",   time: undefined, label: "Anytime", emoji: "📅",  bg: "",         border: "",         text: "#475569" },
] as const;
