import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calendar, Check, ChevronDown, ChevronUp, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Task } from "../../types";
import { estimateTaskDuration, PRIORITY_CHIP } from "../../lib/constants";
import SubtaskRow from "./SubtaskRow";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface Props {
  task: Task;
  listFilter: "date" | "all" | "someday";

  expanded: boolean;
  controlsExpanded: boolean;
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

  breakingDown: boolean;
  onBreakItDown: (task: Task) => void;

  onOpenSchedule: (id: string) => void;

  manualSubtaskValue: string;
  setManualSubtaskValue: (id: string, val: string) => void;
  onAddManualSubtask: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
}

const getPriorityLabel = (p: Task["priority"]) =>
  p === "low" ? "🟢" : p === "medium" ? "🟡" : "🔴";

/**
 * A single task card: checkbox, title, meta, quick actions, expandable
 * controls row (priority/estimate/breakdown/schedule/delete) and
 * subtasks panel. Fully controlled — no local state.
 */
function TaskItemImpl(p: Props) {
  const { task } = p;
  const completedSubs = task.subtasks.filter(s => s.completed).length;
  const totalSubs = task.subtasks.length;
  const subPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
  const estMin = task.estimatedMinutes ?? estimateTaskDuration(task.title);
  const stripe = task.completed
    ? "bg-edge-soft"
    : task.priority === "high" ? "bg-danger"
    : task.priority === "medium" ? "bg-warn"
    : "bg-success";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-surface-sunken border border-edge rounded-xl overflow-hidden transition-all hover:border-brand/40 ${task.completed ? "opacity-60" : ""}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${stripe}`} />

      {/* Row */}
      <div className="pl-4 pr-2 sm:pr-3 py-3 flex items-center gap-3">
        <button
          id={`todo-checkbox-${task.id}`}
          role="checkbox"
          aria-checked={task.completed}
          aria-label={`Toggle "${task.title}"`}
          onClick={() => p.onToggleTask(task.id)}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${task.completed ? "bg-brand border-brand text-primary-foreground" : "border-edge-strong hover:border-brand bg-surface"}`}
        >
          {task.completed && <Check size={14} strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-sm sm:text-[15px] font-semibold text-ink font-fredoka leading-snug truncate ${task.completed ? "line-through" : ""}`}>
            {task.title}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted font-semibold">
            <span className="font-mono">{estMin}m</span>
            {task.scheduledTime && <><span>·</span><span>@ {task.scheduledTime}</span></>}
            {totalSubs > 0 && <><span>·</span><span className="text-brand">{completedSubs}/{totalSubs} steps</span></>}
            {task.scheduledDate && p.listFilter !== "date" && <><span>·</span><span>{task.scheduledDate}</span></>}
          </div>
          {totalSubs > 0 && (
            <div className="mt-1.5 h-1 w-full bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${subPercent}%` }} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!task.completed && (
            <button
              id={`focus-btn-quick-${task.id}`}
              onClick={() => {
                p.onFocusTask(task.title, undefined, task.id);
                p.onFocusAndSwitch?.(task.title, task.id);
                p.onGubbyMessage(`Loading "${task.title}" into Focus Timer!`, "focused");
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-brand hover:bg-brand-hover text-primary-foreground text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              <Play size={11} className="fill-current" /> Focus
            </button>
          )}
          <button
            onClick={() => p.onToggleExpand(task.id)}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
            title="Steps"
          >
            {p.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => p.onToggleControls(task.id)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${p.controlsExpanded ? "text-brand bg-brand-soft/30" : "text-ink-muted hover:text-ink hover:bg-surface"}`}
            title="More"
          >
            <span className="text-sm font-bold leading-none">···</span>
          </button>
        </div>
      </div>

      {/* Extra controls row */}
      <AnimatePresence>
        {p.controlsExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-edge-soft"
          >
            <div className="pl-4 pr-3 py-2.5 flex flex-wrap items-center gap-2 bg-surface/30">
              {/* priority menu */}
              <div className="relative">
                <button
                  id={`priority-btn-${task.id}`}
                  onClick={(e) => { e.stopPropagation(); p.setOpenPriorityMenuId(p.openPriorityMenuId === task.id ? null : task.id); }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${PRIORITY_CHIP[task.priority]}`}
                >
                  {getPriorityLabel(task.priority)} <span className="capitalize">{task.priority}</span>
                </button>
                {p.openPriorityMenuId === task.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => p.setOpenPriorityMenuId(null)} />
                    <div className="absolute left-0 top-full mt-1 bg-surface border border-edge rounded-xl shadow-xl z-50 p-1 min-w-[130px]">
                      {(["low", "medium", "high"] as const).map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => { p.onUpdateTask(task.id, { priority: lvl }); p.setOpenPriorityMenuId(null); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${task.priority === lvl ? "bg-brand-soft/40 text-ink" : "text-ink-muted hover:bg-surface-sunken"}`}
                        >
                          {getPriorityLabel(lvl)} <span className="capitalize">{lvl}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* estimate stepper */}
              <div className="inline-flex items-center bg-surface border border-edge-soft rounded-lg">
                <button
                  onClick={() => { const n = Math.max(5, estMin - 5); p.onUpdateTask(task.id, { estimatedMinutes: n }); }}
                  className="px-2 py-1 text-brand font-bold hover:bg-brand-soft/30 rounded-l-lg cursor-pointer"
                >−</button>
                <button
                  onClick={() => p.setOpenClockPickerId(p.openClockPickerId === task.id ? null : task.id)}
                  className="px-2 py-1 text-xs font-bold font-mono text-ink hover:text-brand cursor-pointer relative"
                >
                  {Math.floor(estMin / 60) > 0 ? `${Math.floor(estMin / 60)}h ${estMin % 60}m` : `${estMin}m`}
                  {p.openClockPickerId === task.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); p.setOpenClockPickerId(null); }} />
                      <div className="absolute left-0 top-full mt-2 bg-surface border border-edge p-3 rounded-2xl shadow-xl z-50 min-w-[220px] text-left space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Presets</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[15, 25, 45, 60, 90, 120].map(preset => (
                            <button
                              key={preset}
                              onClick={(e) => { e.stopPropagation(); p.onUpdateTask(task.id, { estimatedMinutes: preset }); }}
                              className="text-[11px] font-bold text-ink-muted hover:text-ink bg-surface-sunken hover:bg-brand-soft/30 border border-edge-soft rounded-lg py-1 cursor-pointer"
                            >{preset >= 60 ? `${Math.floor(preset / 60)}h${preset % 60 ? ` ${preset % 60}m` : ""}` : `${preset}m`}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </button>
                <button
                  onClick={() => p.onUpdateTask(task.id, { estimatedMinutes: estMin + 5 })}
                  className="px-2 py-1 text-brand font-bold hover:bg-brand-soft/30 rounded-r-lg cursor-pointer"
                >+</button>
              </div>

              <button
                onClick={() => { const est = estimateTaskDuration(task.title); p.onUpdateTask(task.id, { estimatedMinutes: est }); }}
                className="p-1.5 rounded-lg text-brand hover:bg-brand-soft/30 cursor-pointer"
                title="Magic re-estimate"
              >
                <Sparkles size={13} />
              </button>

              {totalSubs === 0 && !task.completed && (
                <button
                  id={`breakdown-btn-${task.id}`}
                  onClick={() => p.onBreakItDown(task)}
                  disabled={p.breakingDown}
                  className="px-2.5 py-1.5 text-xs font-bold text-brand bg-brand-soft/30 border border-brand/30 hover:bg-brand-soft/50 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {p.breakingDown ? (
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  ) : <Sparkles size={12} />}
                  Break down
                </button>
              )}

              <button
                id={`schedule-btn-${task.id}`}
                onClick={() => p.onOpenSchedule(task.id)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface cursor-pointer"
                title="Schedule"
              >
                <Calendar size={14} />
              </button>

              <button
                id={`delete-task-btn-${task.id}`}
                onClick={() => { p.onDeleteTask(task.id); p.onGubbyMessage("Quest banished!", "cozy"); }}
                className="ml-auto p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft cursor-pointer"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtasks panel */}
      <AnimatePresence>
        {(p.expanded || p.breakingDown) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-edge-soft bg-surface/40"
          >
            <div className="pl-4 pr-3 py-3 space-y-2">
              {task.subtasks.map(sub => (
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  onToggle={() => p.onToggleSubtask(task.id, sub.id)}
                  onDelete={() => p.onDeleteSubtask(task.id, sub.id)}
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id={`manual-subtask-input-${task.id}`}
                  type="text"
                  value={p.manualSubtaskValue}
                  onChange={(e) => p.setManualSubtaskValue(task.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") p.onAddManualSubtask(task.id); }}
                  placeholder="+ micro-step"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-sunken border border-edge-soft text-xs font-semibold text-ink outline-none focus:border-brand"
                />
                <button
                  onClick={() => p.onAddManualSubtask(task.id)}
                  className="p-1.5 bg-brand hover:bg-brand-hover text-primary-foreground rounded-lg cursor-pointer"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default memo(TaskItemImpl);
