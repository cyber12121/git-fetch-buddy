import type React from "react";
import type { Task } from "../../types";
import { TaskRow } from "./TaskRow";
import { AddInput } from "./AddInput";
import { SOMEDAY_KEY } from "./constants";
import type { TaskRowSharedProps } from "./types";

interface SomedaySectionProps {
  tasks: Task[];
  addingDate: string | null;
  newTitle: string;
  addRef: React.RefObject<HTMLInputElement | null>;
  taskRowProps: TaskRowSharedProps;

  onOpenAdd: () => void;
  onNewTitleChange: (v: string) => void;
  onCommitAdd: (title: string, dateStr: string, time: string | undefined) => void;
  onCancelAdd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

/**
 * The "Someday" backlog strip shown under the week grid.
 * Reuses the same TaskRow / AddInput primitives with `dateStr === undefined`.
 */
export function SomedaySection({
  tasks, addingDate, newTitle, addRef, taskRowProps,
  onOpenAdd, onNewTitleChange, onCommitAdd, onCancelAdd,
  onDragOver, onDragLeave, onDrop,
}: SomedaySectionProps) {
  const isAdding = addingDate === SOMEDAY_KEY;

  const handleEnter = () => {
    if (newTitle.trim()) {
      onCommitAdd(newTitle.trim(), SOMEDAY_KEY, undefined);
      onNewTitleChange("");
    } else {
      onCancelAdd();
    }
  };

  return (
    <div className="hidden lg:block px-8 pt-10 pb-12">
      <div
        className="max-w-[16%]"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onOpenAdd}
      >
        <div className="pb-2 border-b-2 border-ink-muted/30 select-none">
          <span className="text-[17px] font-bold tracking-tight text-ink-muted/70">Someday</span>
        </div>
        <div className="pt-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} dateStr={undefined} {...taskRowProps} />
          ))}
          {isAdding && (
            <AddInput
              addRef={addRef}
              value={newTitle}
              onChange={onNewTitleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleEnter(); }
                else if (e.key === "Escape") { onCancelAdd(); onNewTitleChange(""); }
              }}
              onBlur={() => {
                if (newTitle.trim()) onCommitAdd(newTitle.trim(), SOMEDAY_KEY, undefined);
                onNewTitleChange("");
                onCancelAdd();
              }}
            />
          )}
          {tasks.length === 0 && !isAdding &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b border-edge/60" style={{ minHeight: 36 }} />
            ))}
        </div>
      </div>
    </div>
  );
}
