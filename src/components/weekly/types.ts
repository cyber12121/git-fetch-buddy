import type React from "react";
import type { Task } from "../../types";

/**
 * Callbacks + shared state a TaskRow needs to render itself.
 * Extracted so every row consumer passes exactly one object.
 */
export interface TaskRowSharedProps {
  /** ID of the task currently being edited (used to render the inline editor). */
  editingId: string | null;
  colorPickerId: string | null;
  draggedId: string | null;
  dragOverTaskId: string | null;
  onStartEdit: (task: Task) => void;
  /**
   * Commit an inline rename. Pass `null` to cancel/delete-if-empty.
   * The live keystroke value lives locally inside the row's editor so
   * unrelated rows don't re-render on every character.
   */
  onCommitEdit: (id: string, newTitle: string | null, dateStr?: string) => void;
  /** Fired when the editor sees Enter — opens a fresh "add" row below. */
  onEditEnterAdd: (dateStr?: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onColorSet: (id: string, val: string) => void;
  onColorToggle: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDropOnTask: (e: React.DragEvent, targetId: string, dateStr: string | undefined) => void;
}

/** Public props of the Weekly Planner module. */
export interface WeeklyPlannerModuleProps {
  tasks: Task[];
  onAddTask: (
    title: string,
    priority: "low" | "medium" | "high",
    notes?: string,
    scheduledDate?: string,
  ) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onUpdateTasksList: (updatedTasks: Task[]) => void;
  onGubbyMessage: (
    msg: string,
    mood: "happy" | "thoughtful" | "focused" | "cozy" | "excited",
  ) => void;
  manualEvents: import("../../types").CalendarEvent[];
  onDeleteManualEvent: (id: string) => void;
}
