import type React from "react";
import type { Task } from "../../types";
import { TaskRow } from "./TaskRow";
import { AddInput } from "./AddInput";
import type { TimeBlockConfig } from "./constants";
import type { TaskRowSharedProps } from "./types";

interface TimeBlockProps {
  block: TimeBlockConfig;
  dateStr: string;
  tasks: Task[];
  dragOverKey: string | null;
  addingBlockKey: string | null;
  newTitle: string;
  addRef: React.RefObject<HTMLInputElement | null>;
  taskRowProps: TaskRowSharedProps;
  onDragOver: (dragKey: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, dateStr: string, time: string | undefined) => void;
  onDropOnTask: (
    e: React.DragEvent,
    targetId: string,
    dateStr: string | undefined,
    time: string | undefined,
  ) => void;
  onOpenAdd: (blockKey: string) => void;
  onNewTitleChange: (v: string) => void;
  onCommitAdd: (title: string, dateStr: string, time: string | undefined) => void;
  onCancelAdd: () => void;
}

/**
 * One of the four "Morning / Afternoon / Evening / Anytime" panels shown
 * inside a day column when Time Blocks mode is enabled.
 *
 * Owns:
 *  - drop targeting scoped to this block
 *  - inline add input scoped to this block (`${dateStr}|${time}` key)
 */
export function TimeBlock({
  block, dateStr, tasks, dragOverKey, addingBlockKey, newTitle, addRef, taskRowProps,
  onDragOver, onDragLeave, onDrop, onDropOnTask, onOpenAdd, onNewTitleChange, onCommitAdd, onCancelAdd,
}: TimeBlockProps) {
  const blockKey = `${dateStr}|${block.time ?? ""}`;
  const dragKey = `${dateStr}:${block.key}`;
  const isAddingBlock = addingBlockKey === blockKey;
  const isAnytime = block.key === "anytime";
  const isDragOver = dragOverKey === dragKey;

  const background = isAnytime
    ? (isDragOver ? "rgb(248 250 252)" : "color-mix(in oklab, var(--surface-sunken) 40%, transparent)")
    : (isDragOver ? block.bg : `color-mix(in oklab, ${block.bg} 45%, transparent)`);
  const borderColor = isAnytime
    ? (isDragOver ? "rgb(226 232 240)" : "var(--edge)")
    : (isDragOver ? `color-mix(in oklab, ${block.border} 80%, transparent)` : `color-mix(in oklab, ${block.border} 25%, transparent)`);

  const handleEnter = () => {
    if (newTitle.trim()) {
      onCommitAdd(newTitle.trim(), dateStr, block.time);
      onNewTitleChange("");
    } else {
      onCancelAdd();
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(dragKey); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(e, dateStr, block.time); }}
      onClick={(e) => { e.stopPropagation(); onOpenAdd(blockKey); }}
      className={`cursor-pointer transition-colors rounded-xl p-1.5 border-2 ${isDragOver ? "shadow-sm" : ""}`}
      style={{ background, borderColor }}
    >
      <div
        className="text-[9px] font-extrabold uppercase tracking-wider mb-1 select-none flex items-center gap-1"
        style={{ color: block.text }}
      >
        <span aria-hidden>{block.emoji}</span> {block.label}
      </div>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            dateStr={dateStr}
            {...taskRowProps}
            onDropOnTask={(e, targetId, date) => onDropOnTask(e, targetId, date, block.time)}
          />
        ))}
        {isAddingBlock && (
          <AddInput
            addRef={addRef}
            value={newTitle}
            onChange={onNewTitleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleEnter(); }
              else if (e.key === "Escape") { onCancelAdd(); onNewTitleChange(""); }
            }}
            onBlur={() => {
              if (newTitle.trim()) onCommitAdd(newTitle.trim(), dateStr, block.time);
              onNewTitleChange("");
              onCancelAdd();
            }}
          />
        )}
        {tasks.length === 0 && !isAddingBlock && (
          <div
            className="text-[9px] italic py-1 text-center border border-dashed rounded-lg select-none opacity-50"
            style={{
              color: block.text,
              borderColor: isAnytime ? "var(--edge)" : `color-mix(in oklab, ${block.border} 30%, transparent)`,
            }}
          >
            + add to {block.label.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}
