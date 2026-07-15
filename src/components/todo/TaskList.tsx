import { memo } from "react";
import type { Task } from "../../types";
import TaskItem from "./TaskItem";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface Props {
  tasks: Task[];                 // full task list (for empty-state check)
  filteredTasks: Task[];         // already filtered + sorted
  listFilter: "date" | "all" | "someday";
  activeDate: string;

  expandedTaskIds: Record<string, boolean>;
  expandedControlIds: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onToggleControls: (id: string) => void;

  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onFocusTask: (title: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onFocusAndSwitch?: (title: string, taskId?: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;

  openPriorityMenuId: string | null;
  setOpenPriorityMenuId: (id: string | null) => void;
  openClockPickerId: string | null;
  setOpenClockPickerId: (id: string | null) => void;

  breakingDownTaskIds: Record<string, boolean>;
  onBreakItDown: (task: Task) => void;

  onOpenSchedule: (id: string) => void;

  manualSubtaskInputs: Record<string, string>;
  setManualSubtaskValue: (id: string, val: string) => void;
  onAddManualSubtask: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

/**
 * Renders the task list, or a friendly empty state when nothing matches
 * the current filter. All interaction is delegated to <TaskItem/>.
 */
function TaskListImpl(p: Props) {
  if (p.filteredTasks.length === 0) {
    const emptyMsg = p.tasks.length === 0
      ? "Your quest board is clear"
      : p.listFilter === "date"
        ? `Nothing scheduled for ${p.activeDate}`
        : "No quests match this view";
    return (
      <div className="bg-surface-sunken border border-dashed border-edge rounded-2xl py-14 text-center">
        <div className="text-4xl mb-2 opacity-60">🌿</div>
        <p className="text-ink font-fredoka font-bold text-base">{emptyMsg}</p>
        <p className="text-ink-muted text-xs mt-1 font-semibold">Type above to add your first mission ✨</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {p.filteredTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          listFilter={p.listFilter}
          expanded={!!p.expandedTaskIds[task.id]}
          controlsExpanded={!!p.expandedControlIds[task.id]}
          onToggleExpand={p.onToggleExpand}
          onToggleControls={p.onToggleControls}
          onToggleTask={p.onToggleTask}
          onDeleteTask={p.onDeleteTask}
          onUpdateTask={p.onUpdateTask}
          onFocusTask={p.onFocusTask}
          onFocusAndSwitch={p.onFocusAndSwitch}
          onGubbyMessage={p.onGubbyMessage}
          openPriorityMenuId={p.openPriorityMenuId}
          setOpenPriorityMenuId={p.setOpenPriorityMenuId}
          openClockPickerId={p.openClockPickerId}
          setOpenClockPickerId={p.setOpenClockPickerId}
          breakingDown={!!p.breakingDownTaskIds[task.id]}
          onBreakItDown={p.onBreakItDown}
          onOpenSchedule={p.onOpenSchedule}
          manualSubtaskValue={p.manualSubtaskInputs[task.id] || ""}
          setManualSubtaskValue={p.setManualSubtaskValue}
          onAddManualSubtask={p.onAddManualSubtask}
          onToggleSubtask={p.onToggleSubtask}
          onDeleteSubtask={p.onDeleteSubtask}
        />
      ))}
    </ul>
  );
}

export default memo(TaskListImpl);
