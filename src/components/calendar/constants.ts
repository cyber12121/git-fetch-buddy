export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const COLORS = [
  { value: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Leaf Green 🍃" },
  { value: "bg-amber-100 text-amber-800 border-amber-200", label: "Sweet Amber 🍊" },
  { value: "bg-sky-100 text-sky-800 border-sky-200", label: "Sky Blue 🌊" },
  { value: "bg-purple-100 text-purple-800 border-purple-200", label: "Berry Purple 🍇" }
];

export type FilterType = "all" | "task" | "event";
export type CreateType = "task" | "event";
