import { memo } from "react";
import { Check, Trash2 } from "lucide-react";
import type { SubTask } from "../../types";

interface Props {
  subtask: SubTask;
  onToggle: () => void;
  onDelete: () => void;
}

/**
 * A single subtask row inside a Task's expanded panel.
 * Delete affordance appears on row hover.
 */
function SubtaskRowImpl({ subtask, onToggle, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2.5 group">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${subtask.completed ? "bg-success border-success text-white" : "border-edge-strong hover:border-success bg-surface"}`}
      >
        {subtask.completed && <Check size={10} strokeWidth={3} />}
      </button>
      <span className={`text-xs font-semibold text-ink flex-1 ${subtask.completed ? "line-through text-ink-muted" : ""}`}>
        {subtask.title}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-ink-muted hover:text-danger transition-opacity cursor-pointer"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default memo(SubtaskRowImpl);
