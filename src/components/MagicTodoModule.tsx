import { useCallback } from "react";
import { motion } from "motion/react";
import type { Task } from "../types";
import { useToast } from "./Toast";
import { useMagicTodo } from "./todo/useMagicTodo";
import AddTaskInput from "./todo/AddTaskInput";
import DateStrip from "./todo/DateStrip";
import TaskList from "./todo/TaskList";
import ScheduleModal from "./todo/ScheduleModal";
import TodayHero from "./todo/TodayHero";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface MagicTodoModuleProps {
  tasks: Task[];
  onAddTask: (title: string, priority: "low" | "medium" | "high", notes?: string, scheduledDate?: string, estimatedMinutes?: number) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onFocusTask: (taskTitle: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onFocusAndSwitch?: (taskTitle: string, taskId?: string) => void;
  onGainXp?: (amount: number) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

/**
 * Quest Log module orchestrator.
 *
 * All state and mutations live in `useMagicTodo`. This component wires
 * that state into presentational pieces: TodayHero, AddTaskInput,
 * DateStrip, TaskList, and ScheduleModal.
 */
export default function MagicTodoModule({
  tasks,
  onAddTask,
  onDeleteTask,
  onToggleTask,
  onUpdateTask,
  onFocusTask,
  onFocusAndSwitch,
  onGainXp,
  onGubbyMessage,
  selectedDate,
  onSelectDate,
}: MagicTodoModuleProps) {
  const { pushToast } = useToast();

  const s = useMagicTodo({
    tasks,
    onAddTask,
    onUpdateTask,
    onGubbyMessage,
    onGainXp,
    selectedDate,
  });

  const handleSweepCompleted = useCallback(() => {
    tasks.filter(t => t.completed).forEach(t => onDeleteTask(t.id));
    pushToast({ icon: "🧹", message: "Completed quests swept away", tone: "info" });
  }, [tasks, onDeleteTask, pushToast]);

  const setManualSubtaskValue = useCallback((id: string, val: string) => {
    s.setManualSubtaskInputs(prev => ({ ...prev, [id]: val }));
  }, [s]);

  const completedCount = tasks.filter(t => t.completed).length;
  const schedulingTask = s.schedulingTaskId
    ? tasks.find(t => t.id === s.schedulingTaskId)
    : undefined;

  return (
    <div id="magic-todo-module" className="max-w-5xl mx-auto px-1 sm:px-0 pb-8">
      {/* ── HEADER STRIP: identity + today's progress bar ─────────── */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">Today · {s.todayStr}</div>
            <h1 className="text-2xl sm:text-3xl font-fredoka font-bold text-ink truncate">Quest Log</h1>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-2xl sm:text-3xl font-bold text-brand tabular-nums leading-none">
              {s.todayPct}<span className="text-sm text-ink-muted">%</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mt-1">
              {s.doneToday}/{s.todayTotal} done
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-surface-sunken rounded-full overflow-hidden border border-edge-soft">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${s.todayPct}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
            className="h-full bg-gradient-to-r from-brand to-brand-hover rounded-full"
            style={{ boxShadow: "var(--theme-glow)" }}
          />
        </div>
      </div>

      <TodayHero
        top3Today={s.top3Today}
        onFocusTask={onFocusTask}
        onFocusAndSwitch={onFocusAndSwitch}
        onGubbyMessage={onGubbyMessage}
      />

      <AddTaskInput
        newTitle={s.newTitle}
        setNewTitle={s.setNewTitle}
        priorityVal={s.priorityVal}
        onPriorityChange={s.handlePriorityChange}
        formError={s.formError}
        setFormError={s.setFormError}
        onSubmit={s.submitNewTask}
        onVoiceResult={s.handleVoiceResult}
      />

      <DateStrip
        listFilter={s.listFilter}
        onFilterChange={s.setListFilter}
        activeDate={s.activeDate}
        onSelectDate={onSelectDate}
        filteredCount={s.filteredTasks.length}
        totalActive={s.totalActive}
        completedCount={completedCount}
        onSweepCompleted={handleSweepCompleted}
      />

      <TaskList
        tasks={tasks}
        filteredTasks={s.filteredTasks}
        listFilter={s.listFilter}
        activeDate={s.activeDate}
        expandedTaskIds={s.expandedTaskIds}
        expandedControlIds={s.expandedControlIds}
        onToggleExpand={s.toggleExpand}
        onToggleControls={s.toggleControls}
        onToggleTask={onToggleTask}
        onDeleteTask={onDeleteTask}
        onUpdateTask={onUpdateTask}
        onFocusTask={onFocusTask}
        onFocusAndSwitch={onFocusAndSwitch}
        onGubbyMessage={onGubbyMessage}
        openPriorityMenuId={s.openPriorityMenuId}
        setOpenPriorityMenuId={s.setOpenPriorityMenuId}
        openClockPickerId={s.openClockPickerId}
        setOpenClockPickerId={s.setOpenClockPickerId}
        breakingDownTaskIds={s.breakingDownTaskIds}
        onBreakItDown={s.handleBreakItDown}
        onOpenSchedule={s.handleOpenSchedule}
        manualSubtaskInputs={s.manualSubtaskInputs}
        setManualSubtaskValue={setManualSubtaskValue}
        onAddManualSubtask={s.handleAddManualSubtask}
        onToggleSubtask={s.handleToggleSubtask}
        onDeleteSubtask={s.handleDeleteSubtask}
      />

      <ScheduleModal
        open={!!s.schedulingTaskId}
        taskTitle={schedulingTask?.title}
        date={s.scheduleDate}
        time={s.scheduleTime}
        error={s.scheduleError}
        onDateChange={s.setScheduleDate}
        onTimeChange={s.setScheduleTime}
        onCancel={s.closeSchedule}
        onSave={s.handleSaveSchedule}
      />
    </div>
  );
}
