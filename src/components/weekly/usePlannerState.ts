import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { Task } from "../../types";
import { toLocalDateKey } from "../../lib/constants";
import {
  getMonday,
  formatWeekHeader,
  generateLocalTaskId,
} from "./utils";
import {
  DAYS_SHORT,
  MONTHS_SHORT,
  SOMEDAY_KEY,
  TIME_BLOCKS_STORAGE_KEY,
} from "./constants";
import type { TaskRowSharedProps, WeeklyPlannerModuleProps } from "./types";

/**
 * All state, memoized derivations, and event handlers for the Weekly Planner.
 *
 * Split out of the render component so:
 *  - the JSX file stays under ~200 lines,
 *  - the state graph is testable in isolation,
 *  - handlers get stable refs via useCallback and can be safely passed
 *    to memoized child components.
 */
export function usePlannerState(props: WeeklyPlannerModuleProps) {
  const {
    tasks, manualEvents,
    onAddTask, onDeleteTask, onToggleTask, onUpdateTask, onUpdateTasksList,
    onGubbyMessage, onDeleteManualEvent,
  } = props;

  // ─── Navigation & view mode ─────────────────────────────────────────────
  const [refDate, setRefDate] = useState<Date>(() => new Date());

  const [showTimeBlocks, setShowTimeBlocks] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TIME_BLOCKS_STORAGE_KEY) === "true";
    } catch {
      // Private mode or storage disabled — fall back to flat view.
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TIME_BLOCKS_STORAGE_KEY, String(showTimeBlocks));
    } catch {
      /* ignore storage failures */
    }
  }, [showTimeBlocks]);

  // ─── Inline add / edit state ────────────────────────────────────────────
  /** dateStr of the day currently showing a flat AddInput, or null. */
  const [addingDate, setAddingDate] = useState<string | null>(null);
  /** `${dateStr}|${time|""}` of the time-block currently showing an AddInput. */
  const [addingBlockKey, setAddingBlockKey] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  // ─── Drag-and-drop state ────────────────────────────────────────────────
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // ─── Refs for focus management ──────────────────────────────────────────
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((addingDate || addingBlockKey) && addRef.current) addRef.current.focus();
  }, [addingDate, addingBlockKey]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  // ─── Derived: week days & label ─────────────────────────────────────────
  const weekDays = useMemo(() => {
    const monday = getMonday(refDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [refDate]);

  const headerTitle = useMemo(
    () => formatWeekHeader(weekDays[0], weekDays[6]),
    [weekDays],
  );

  const todayStr = useMemo(() => toLocalDateKey(new Date()), []);
  const isToday = useCallback((d: Date) => toLocalDateKey(d) === todayStr, [todayStr]);

  // ─── Derived: task grouping (single pass over tasks per input change) ───
  const { tasksByDate, somedayTasks } = useMemo(() => {
    const byDate = new Map<string, Task[]>();
    const someday: Task[] = [];
    for (const t of tasks) {
      if (!t.scheduledDate) {
        someday.push(t);
      } else {
        const list = byDate.get(t.scheduledDate);
        if (list) list.push(t);
        else byDate.set(t.scheduledDate, [t]);
      }
    }
    return { tasksByDate: byDate, somedayTasks: someday };
  }, [tasks]);

  const eventsByDate = useMemo(() => {
    const byDate = new Map<string, typeof manualEvents>();
    for (const e of manualEvents ?? []) {
      const list = byDate.get(e.date);
      if (list) list.push(e);
      else byDate.set(e.date, [e]);
    }
    return byDate;
  }, [manualEvents]);

  const tasksFor = useCallback((ds: string): Task[] => tasksByDate.get(ds) ?? [], [tasksByDate]);
  const eventsFor = useCallback((ds: string) => eventsByDate.get(ds) ?? [], [eventsByDate]);

  // ─── Add ────────────────────────────────────────────────────────────────
  /**
   * Add a task with an optional scheduled time. Used by the time-block adder.
   * Builds the Task locally and hands the full updated list to the parent so
   * scheduledTime survives (onAddTask has no time parameter).
   */
  const addTaskWithTime = useCallback(
    (title: string, dateStr: string, time: string | undefined) => {
      const scheduledDate = dateStr === SOMEDAY_KEY ? undefined : dateStr;
      const newTask: Task = {
        id: generateLocalTaskId(),
        title,
        priority: "medium",
        notes: "Added in Weekly Planner",
        completed: false,
        subtasks: [],
        scheduledDate,
        scheduledTime: time,
        createdAt: new Date().toISOString(),
      };
      onUpdateTasksList([...tasks, newTask]);
      onGubbyMessage("Task added! 📝", "happy");
    },
    [tasks, onUpdateTasksList, onGubbyMessage],
  );

  /**
   * Commit the current add input. Routes through onAddTask (no time) when
   * `time === undefined`, or addTaskWithTime otherwise.
   */
  const commitAdd = useCallback(
    (title: string, dateStr: string, time: string | undefined) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      if (time === undefined) {
        const scheduledDate = dateStr === SOMEDAY_KEY ? undefined : dateStr;
        onAddTask(trimmed, "medium", "Added in Weekly Planner", scheduledDate);
        onGubbyMessage("Task added! 📝", "happy");
      } else {
        addTaskWithTime(trimmed, dateStr, time);
      }
    },
    [onAddTask, onGubbyMessage, addTaskWithTime],
  );

  const cancelAdd = useCallback(() => {
    setAddingDate(null);
    setAddingBlockKey(null);
  }, []);

  const openColumnAdd = useCallback((dateStr: string) => {
    setAddingDate(dateStr);
    setAddingBlockKey(null);
    setNewTitle("");
    setEditingId(null);
  }, []);

  const openBlockAdd = useCallback((blockKey: string) => {
    setAddingBlockKey(blockKey);
    setAddingDate(null);
    setNewTitle("");
    setEditingId(null);
  }, []);

  // ─── Edit ───────────────────────────────────────────────────────────────
  const onStartEdit = useCallback((task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  }, []);
  const onEditChange = useCallback((val: string) => setEditTitle(val), []);
  const onEditKeyDown = useCallback(
    (e: React.KeyboardEvent, _id: string, dateStr?: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
        // Jump straight into a new blank row under the same day.
        setAddingDate(dateStr ?? SOMEDAY_KEY);
        setAddingBlockKey(null);
        setNewTitle("");
      } else if (e.key === "Escape") {
        setEditingId(null);
      }
    },
    [],
  );
  const onEditBlur = useCallback(
    (id: string) => {
      const trimmed = editTitle.trim();
      if (trimmed) onUpdateTask(id, { title: trimmed });
      else onDeleteTask(id);
      setEditingId(null);
    },
    [editTitle, onUpdateTask, onDeleteTask],
  );

  // ─── Color picker ───────────────────────────────────────────────────────
  const onColorSet = useCallback(
    (id: string, val: string) => {
      onUpdateTask(id, { color: val || undefined });
      setColorPickerId(null);
    },
    [onUpdateTask],
  );
  const onColorToggle = useCallback(
    (id: string) => setColorPickerId((prev) => (prev === id ? null : id)),
    [],
  );

  // ─── Drag & drop ────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  }, []);

  const onDragOverDate = useCallback((e: React.DragEvent, ds: string) => {
    e.preventDefault();
    setDragOverDate(ds);
  }, []);

  const onBlockDragOver = useCallback((dragKey: string) => {
    setDragOverDate(dragKey);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOverDate(null);
    setDragOverTaskId(null);
  }, []);

  const onDragOverTask = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverTaskId(id);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, targetDate: string | undefined, targetTime?: string) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || draggedId;
      setDragOverDate(null);
      setDragOverTaskId(null);
      if (id) {
        // Always assign scheduledTime — moving to the Anytime block or Someday
        // must clear an existing time, otherwise the task keeps its old bucket.
        onUpdateTask(id, { scheduledDate: targetDate, scheduledTime: targetTime });
      }
      setDraggedId(null);
    },
    [draggedId, onUpdateTask],
  );

  const onDropOnTask = useCallback(
    (e: React.DragEvent, targetTaskId: string, targetDate: string | undefined, targetTime?: string) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.dataTransfer.getData("text/plain") || draggedId;
      setDragOverDate(null);
      setDragOverTaskId(null);
      if (!id || id === targetTaskId) return;

      const updated = [...tasks];
      const di = updated.findIndex((t) => t.id === id);
      if (di === -1) return;
      const [item] = updated.splice(di, 1);
      // Bug fix: previously targetTime was only applied when defined, which
      // silently kept the old time when reordering into Anytime.
      item.scheduledDate = targetDate;
      item.scheduledTime = targetTime;

      const ti = updated.findIndex((t) => t.id === targetTaskId);
      if (ti === -1) return;
      updated.splice(ti, 0, item);
      onUpdateTasksList(updated);
      setDraggedId(null);
    },
    [draggedId, tasks, onUpdateTasksList],
  );

  // ─── Week navigation ────────────────────────────────────────────────────
  const goPrevWeek = useCallback(() => {
    setRefDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() - 7);
      return next;
    });
    onGubbyMessage("Back a week! 🕰️", "thoughtful");
  }, [onGubbyMessage]);

  const goNextWeek = useCallback(() => {
    setRefDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    });
    onGubbyMessage("Forward a week! 🚀", "happy");
  }, [onGubbyMessage]);

  const toggleTimeBlocks = useCallback(() => {
    setShowTimeBlocks((prev) => {
      const next = !prev;
      onGubbyMessage(
        next
          ? "Time blocks activated! Snap your tasks to morning, afternoon, or evening ☀️"
          : "Time blocks off. Flat view activated!",
        "cozy",
      );
      return next;
    });
  }, [onGubbyMessage]);

  // ─── Event deletion (with a message) ────────────────────────────────────
  const handleDeleteEvent = useCallback(
    (id: string) => {
      onDeleteManualEvent(id);
      onGubbyMessage("Event removed! 💨", "cozy");
    },
    [onDeleteManualEvent, onGubbyMessage],
  );

  // ─── Bundled props for TaskRow ──────────────────────────────────────────
  const taskRowProps: TaskRowSharedProps = useMemo(
    () => ({
      editingId, editTitle, colorPickerId, draggedId, dragOverTaskId, editRef,
      onStartEdit, onEditChange, onEditKeyDown, onEditBlur,
      onToggle: onToggleTask, onDelete: onDeleteTask,
      onColorSet, onColorToggle,
      onDragStart, onDragOver: onDragOverTask, onDragLeave, onDropOnTask,
    }),
    [
      editingId, editTitle, colorPickerId, draggedId, dragOverTaskId,
      onStartEdit, onEditChange, onEditKeyDown, onEditBlur,
      onToggleTask, onDeleteTask, onColorSet, onColorToggle,
      onDragStart, onDragOverTask, onDragLeave, onDropOnTask,
    ],
  );

  // ─── Small formatters exposed for the view ──────────────────────────────
  const fmtLabel = useCallback((d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, []);
  const fmtSub = useCallback((d: Date) => DAYS_SHORT[d.getDay()], []);

  return {
    // state
    showTimeBlocks, addingDate, addingBlockKey, newTitle, dragOverDate,
    // refs
    addRef,
    // derived
    weekDays, headerTitle, isToday, tasksFor, eventsFor, somedayTasks,
    fmtLabel, fmtSub,
    // props bundles
    taskRowProps,
    // setters exposed for input
    setNewTitle,
    // actions
    commitAdd, cancelAdd, openColumnAdd, openBlockAdd,
    onDragOverDate, onDragLeave, onDrop, onDropOnTask, onBlockDragOver,
    handleDeleteEvent, goPrevWeek, goNextWeek, toggleTimeBlocks,
  };
}
