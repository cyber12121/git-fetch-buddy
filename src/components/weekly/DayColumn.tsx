import { useMemo } from "react";
import type React from "react";
import type { Task, CalendarEvent } from "../../types";
import { TaskRow } from "./TaskRow";
import { EventRow } from "./EventRow";
import { AddInput } from "./AddInput";
import { TimeBlock } from "./TimeBlock";
import { getTaskTimeBlock } from "./utils";
import { SOMEDAY_KEY, TIME_BLOCKS } from "./constants";
import type { TaskRowSharedProps } from "./types";

interface DayColumnProps {
  label: string;
  sublabel: string;
  dateStr: string;
  today: boolean;
  /** Number of "ruled" empty rows to pad up to when in flat view. */
  lines?: number;

  dayTasks: Task[];
  dayEvents: CalendarEvent[];

  showTimeBlocks: boolean;
  addingDate: string | null;
  addingBlockKey: string | null;
  newTitle: string;
  dragOverKey: string | null;

  addRef: React.RefObject<HTMLInputElement | null>;
  taskRowProps: TaskRowSharedProps;

  onColumnClick: (dateStr: string) => void;
  onColumnDragOver: (e: React.DragEvent, dateStr: string) => void;
  onColumnDragLeave: () => void;
  onColumnDrop: (e: React.DragEvent, dateStr: string | undefined, time?: string) => void;

  onNewTitleChange: (v: string) => void;
  onCommitAdd: (title: string, dateStr: string, time: string | undefined) => void;
  onCancelAdd: () => void;
  onOpenBlockAdd: (blockKey: string) => void;
  onDeleteEvent: (id: string) => void;

  onBlockDragOver: (dragKey: string) => void;
  onDropOnTaskWithTime: (
    e: React.DragEvent,
    targetId: string,
    dateStr: string | undefined,
    time: string | undefined,
  ) => void;
}

/**
 * A vertical day column: header, then either a flat task list (with ruled
 * empty rows) or four TimeBlock panels when Time Blocks mode is enabled.
 *
 * Someday behaves like a flat column with no drag time.
 */
export function DayColumn({
  label, sublabel, dateStr, today, lines = 10,
  dayTasks, dayEvents,
  showTimeBlocks, addingDate, addingBlockKey, newTitle, dragOverKey,
  addRef, taskRowProps,
  onColumnClick, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  onNewTitleChange, onCommitAdd, onCancelAdd, onOpenBlockAdd, onDeleteEvent,
  onBlockDragOver, onDropOnTaskWithTime,
}: DayColumnProps) {
  const isSomeday = dateStr === SOMEDAY_KEY;
  const isAdding = addingDate === dateStr;

  // Split-by-block once so each TimeBlock doesn't re-scan the day array.
  const tasksByBlock = useMemo(() => {
    const buckets = { morning: [] as Task[], afternoon: [] as Task[], evening: [] as Task[], anytime: [] as Task[] };
    for (const t of dayTasks) buckets[getTaskTimeBlock(t)].push(t);
    return buckets;
  }, [dayTasks]);

  const emptyLines = Math.max(0, lines - dayEvents.length - dayTasks.length - (isAdding ? 1 : 0));

  const handleFlatEnter = () => {
    if (newTitle.trim()) {
      onCommitAdd(newTitle.trim(), dateStr, undefined);
      onNewTitleChange("");
    } else {
      onCancelAdd();
    }
  };

  return (
    <div
      className={`flex flex-col min-w-0 flex-1 transition-colors rounded-lg ${
        dragOverKey === dateStr ? "bg-surface-sunken/60" : ""
      }`}
      onDragOver={(e) => { if (!showTimeBlocks) onColumnDragOver(e, dateStr); }}
      onDragLeave={onColumnDragLeave}
      onDrop={(e) => { if (!showTimeBlocks) onColumnDrop(e, isSomeday ? undefined : dateStr); }}
      onClick={() => {
        // In time-block mode, clicking the column background shouldn't open
        // a flat add row — blocks own their own adders.
        if (!showTimeBlocks) onColumnClick(dateStr);
      }}
    >
      {/* Header — bold date left, muted weekday right, thin underline (blue when today) */}
      <div className={`flex items-baseline justify-between pb-2 select-none border-b-2 ${today ? "border-brand" : "border-ink"}`}>
        <span className={`text-[17px] font-bold tracking-tight ${today ? "text-brand" : "text-ink"}`}>{label}</span>
        <span className={`text-[13px] font-medium ${today ? "text-brand/70" : "text-ink-muted/60"}`}>{sublabel}</span>
      </div>

      {showTimeBlocks && !isSomeday ? (
        <div className="flex flex-col w-full gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          {dayEvents.length > 0 && (
            <div className="space-y-1">
              {dayEvents.map((evt) => (
                <EventRow key={evt.id} evt={evt} onDelete={onDeleteEvent} />
              ))}
            </div>
          )}

          {TIME_BLOCKS.map((block) => (
            <TimeBlock
              key={block.key}
              block={block}
              dateStr={dateStr}
              tasks={tasksByBlock[block.key]}
              dragOverKey={dragOverKey}
              addingBlockKey={addingBlockKey}
              newTitle={newTitle}
              addRef={addRef}
              taskRowProps={taskRowProps}
              onDragOver={onBlockDragOver}
              onDragLeave={onColumnDragLeave}
              onDrop={(e, ds, t) => onColumnDrop(e, ds, t)}
              onDropOnTask={onDropOnTaskWithTime}
              onOpenAdd={onOpenBlockAdd}
              onNewTitleChange={onNewTitleChange}
              onCommitAdd={onCommitAdd}
              onCancelAdd={onCancelAdd}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col w-full">
          {dayEvents.map((evt) => (
            <EventRow key={evt.id} evt={evt} onDelete={onDeleteEvent} />
          ))}
          {dayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dateStr={isSomeday ? undefined : dateStr}
              {...taskRowProps}
            />
          ))}
          {isAdding && (
            <AddInput
              addRef={addRef}
              value={newTitle}
              onChange={onNewTitleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleFlatEnter(); }
                else if (e.key === "Escape") { onCancelAdd(); onNewTitleChange(""); }
              }}
              onBlur={() => {
                if (newTitle.trim()) onCommitAdd(newTitle.trim(), dateStr, undefined);
                onNewTitleChange("");
                onCancelAdd();
              }}
            />
          )}
          {/* Ruled empty rows so short days still look like paper */}
          {Array.from({ length: emptyLines }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-edge/60" style={{ minHeight: 36 }} />
          ))}
        </div>
      )}
    </div>
  );
}
