/**
 * WeeklyPlannerModule — the tweek.so-style week grid.
 *
 * This file is intentionally thin: it composes small pieces from
 * `src/components/weekly/*` and wires them to the `usePlannerState` hook.
 *
 *   ┌── WeekHeader ──────────────────────────────────────────┐
 *   │ month title · Time-blocks toggle · prev/next            │
 *   ├───────────┬───────────┬───────────┬───────────┬─────────┤
 *   │ DayColumn │ DayColumn │ DayColumn │ DayColumn │ Sat/Sun │
 *   └───────────┴───────────┴───────────┴───────────┴─────────┘
 *   SomedaySection (desktop) — mobile stacks everything vertically.
 */
import { toLocalDateKey } from "../lib/constants";
import { WeekHeader } from "./weekly/WeekHeader";
import { DayColumn } from "./weekly/DayColumn";
import { SomedaySection } from "./weekly/SomedaySection";
import { SOMEDAY_KEY } from "./weekly/constants";
import { usePlannerState } from "./weekly/usePlannerState";
import type { WeeklyPlannerModuleProps } from "./weekly/types";

export default function WeeklyPlannerModule(props: WeeklyPlannerModuleProps) {
  const s = usePlannerState(props);
  const [mon, tue, wed, thu, fri, sat, sun] = s.weekDays;

  /** Shared DayColumn props derived from the state hook. */
  const columnDefaults = {
    showTimeBlocks: s.showTimeBlocks,
    addingDate: s.addingDate,
    addingBlockKey: s.addingBlockKey,
    newTitle: s.newTitle,
    dragOverKey: s.dragOverDate,
    addRef: s.addRef,
    taskRowProps: s.taskRowProps,

    onColumnClick: s.openColumnAdd,
    onColumnDragOver: s.onDragOverDate,
    onColumnDragLeave: s.onDragLeave,
    onColumnDrop: s.onDrop,

    onNewTitleChange: s.setNewTitle,
    onCommitAdd: s.commitAdd,
    onCancelAdd: s.cancelAdd,
    onOpenBlockAdd: s.openBlockAdd,
    onDeleteEvent: s.handleDeleteEvent,

    onBlockDragOver: s.onBlockDragOver,
    onDropOnTaskWithTime: s.onDropOnTask,
  };

  const renderColumn = (d: Date, lines: number) => {
    const dateStr = toLocalDateKey(d);
    return (
      <DayColumn
        {...columnDefaults}
        label={s.fmtLabel(d)}
        sublabel={s.fmtSub(d)}
        dateStr={dateStr}
        today={s.isToday(d)}
        lines={lines}
        dayTasks={s.tasksFor(dateStr)}
        dayEvents={s.eventsFor(dateStr)}
      />
    );
  };

  return (
    <div
      className="min-h-screen bg-canvas text-ink"
      style={{ fontFamily: "'Fredoka', 'Nunito', sans-serif" }}
    >
      <WeekHeader
        title={s.headerTitle}
        showTimeBlocks={s.showTimeBlocks}
        onToggleTimeBlocks={s.toggleTimeBlocks}
        onPrevWeek={s.goPrevWeek}
        onNextWeek={s.goNextWeek}
      />

      {/* Desktop: 6 columns, Sat+Sun stacked in the last cell */}
      <div className="hidden lg:flex gap-8 px-8">
        {[mon, tue, wed, thu, fri].map((d) => (
          <div key={toLocalDateKey(d)} className="flex-1 min-w-0">
            {renderColumn(d, 12)}
          </div>
        ))}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex-1">{renderColumn(sat, 5)}</div>
          <div className="flex-1">{renderColumn(sun, 5)}</div>
        </div>
      </div>

      {/* Desktop: Someday backlog */}
      <SomedaySection
        tasks={s.somedayTasks}
        addingDate={s.addingDate}
        newTitle={s.newTitle}
        addRef={s.addRef}
        taskRowProps={s.taskRowProps}
        onOpenAdd={() => s.openColumnAdd(SOMEDAY_KEY)}
        onNewTitleChange={s.setNewTitle}
        onCommitAdd={s.commitAdd}
        onCancelAdd={s.cancelAdd}
        onDragOver={(e) => s.onDragOverDate(e, SOMEDAY_KEY)}
        onDragLeave={s.onDragLeave}
        onDrop={(e) => s.onDrop(e, undefined)}
      />

      {/* Mobile: stacked columns */}
      <div className="flex flex-col lg:hidden px-5 py-4 gap-6">
        {s.weekDays.map((d) => (
          <div key={toLocalDateKey(d)}>{renderColumn(d, 5)}</div>
        ))}
        <div>
          <DayColumn
            {...columnDefaults}
            label="Someday"
            sublabel=""
            dateStr={SOMEDAY_KEY}
            today={false}
            lines={5}
            dayTasks={s.somedayTasks}
            dayEvents={[]}
          />
        </div>
      </div>
    </div>
  );
}
