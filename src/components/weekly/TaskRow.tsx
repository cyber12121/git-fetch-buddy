import { memo } from "react";
import { Check, Trash2 } from "lucide-react";
import type { Task } from "../../types";
import { PILL_COLORS } from "./constants";
import { parseItalicMarkdown } from "./utils";
import { ColorPicker } from "./ColorPicker";
import type { TaskRowSharedProps } from "./types";

interface TaskRowProps extends TaskRowSharedProps {
  task: Task;
  /** `undefined` for the Someday column. */
  dateStr: string | undefined;
}

/**
 * A single task row: inline-editable title, color pill, drag handle,
 * completion toggle, and delete button.
 *
 * Placeholder tasks (title wrapped in `___...___`) are shown dimmed and
 * are not draggable — used as ghost hints elsewhere in the app.
 */
function TaskRowImpl({
  task, dateStr,
  editingId, editTitle, colorPickerId, draggedId, dragOverTaskId, editRef,
  onStartEdit, onEditChange, onEditKeyDown, onEditBlur, onToggle, onDelete,
  onColorSet, onColorToggle, onDragStart, onDragOver, onDragLeave, onDropOnTask,
}: TaskRowProps) {
  const pill = PILL_COLORS.find((c) => c.value === task.color);
  const isEditing = editingId === task.id;
  const isPlaceholder = task.title.startsWith("___") && task.title.endsWith("___");
  const cleanTitle = isPlaceholder ? task.title.slice(3, -3) : task.title;

  return (
    <div
      draggable={!isPlaceholder}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, task.id); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDropOnTask(e, task.id, dateStr)}
      onClick={(e) => e.stopPropagation()}
      className={`group relative flex items-center w-full transition-colors border-b border-edge/60 ${
        isPlaceholder ? "opacity-40" : ""
      } ${dragOverTaskId === task.id ? "border-t-2 border-t-brand" : ""}`}
      style={{ minHeight: 36, opacity: draggedId === task.id ? 0.3 : undefined }}
    >
      <div
        className="flex-1 min-w-0 px-2 py-0.5 cursor-text"
        onClick={() => { if (!isEditing) onStartEdit(task); }}
      >
        {isEditing ? (
          <input
            ref={editRef}
            value={editTitle}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => onEditKeyDown(e, task.id, dateStr)}
            onBlur={() => onEditBlur(task.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm bg-transparent outline-none text-ink font-normal"
          />
        ) : pill && pill.value ? (
          <span
            className={`inline-block text-[13px] font-medium px-2 py-0.5 rounded break-words whitespace-pre-wrap ${
              task.completed ? "line-through opacity-40" : ""
            }`}
            style={{ background: pill.bg, color: pill.text, wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {isPlaceholder ? (
              <span className="italic text-ink-muted font-normal">{cleanTitle}</span>
            ) : (
              parseItalicMarkdown(cleanTitle)
            )}
          </span>
        ) : (
          <span
            className={`text-[13px] font-normal leading-snug block break-words whitespace-pre-wrap ${
              task.completed ? "line-through text-ink-muted " : "text-ink-2 "
            }`}
            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            {isPlaceholder ? (
              <span className="italic text-ink-muted font-normal">{cleanTitle}</span>
            ) : (
              parseItalicMarkdown(cleanTitle)
            )}
          </span>
        )}
      </div>

      {/* Row actions — visible on hover */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!isPlaceholder && (
          <ColorPicker taskId={task.id} activeId={colorPickerId} onSet={onColorSet} onToggle={onColorToggle} />
        )}
        <button
          type="button"
          aria-label={`Delete task ${cleanTitle}`}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1 rounded hover:bg-red-50 text-ink-muted hover:text-rose-400 transition-colors cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Completion toggle */}
      {!isPlaceholder && (
        <button
          type="button"
          aria-label={task.completed ? "Mark task not done" : "Mark task done"}
          aria-pressed={task.completed}
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className={`mr-1 shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
            task.completed
              ? "border-brand text-brand opacity-100"
              : "border-edge text-transparent opacity-0 group-hover:opacity-60 hover:border-brand"
          }`}
        >
          <Check size={10} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export const TaskRow = memo(TaskRowImpl);
