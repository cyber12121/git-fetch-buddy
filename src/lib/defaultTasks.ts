import { Task } from "../types";
import { toLocalDateKey } from "./constants";

/**
 * High-value seed tasks used on a fresh install so the ADHD-friendly onboarding
 * has something to poke at immediately. Kept out of App.tsx to keep the shell
 * component focused on wiring, not content.
 */
export const DEFAULT_TASKS: Task[] = [
  {
    id: "default-task-1",
    title: "Gather cozy moss from the forest brook",
    priority: "medium",
    notes: "Requires rubber boots and a tiny container. Damp soil smells amazing!",
    completed: false,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 30,
    subtasks: [
      { id: "def-sub-1", title: "Put on waterproof boots 🥾", completed: true },
      { id: "def-sub-2", title: "Locate damp, shaded log near riverbank", completed: false },
      { id: "def-sub-3", title: "Gently scoop a handful of moss", completed: false },
    ],
    scheduledDate: toLocalDateKey(), // today
  },
  {
    id: "default-task-2",
    title: "Clean the terrifying messy room heap",
    priority: "high",
    notes: "It has been staring at me for 3 weeks. High threat level!",
    completed: false,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 45,
    subtasks: [
      { id: "def-sub-4", title: "Pick up exactly 3 pieces of paper from floor", completed: false },
      { id: "def-sub-5", title: "Put exactly 1 dirty shirt in the basket", completed: false },
      { id: "def-sub-6", title: "Open a window to let fresh air in 💨", completed: false },
    ],
  },
  {
    id: "default-task-3",
    title: "Polish the shiny crown 👑",
    priority: "low",
    notes: "A quick, satisfying win to boost dopamine!",
    completed: true,
    createdAt: new Date().toISOString(),
    estimatedMinutes: 10,
    subtasks: [],
  },
];
