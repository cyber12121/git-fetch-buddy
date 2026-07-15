import { memo, useMemo } from "react";
import { ClipboardList, Check, Circle } from "lucide-react";
import { Task } from "../types";
import { toLocalDateKey } from "../lib/constants";

interface TodaysQuestsProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
}

/**
 * Rail card: today's scheduled quests (or the 5 most recent when none are
 * scheduled). Memoized because App re-renders on every unrelated global
 * change (XP tick, Sprig message, theme swap) — without `memo` this list
 * re-renders even when its own tasks haven't changed. The filter + slice
 * are also memoized so their identity is stable across those renders.
 */
function TodaysQuestsImpl({ tasks, onToggleTask }: TodaysQuestsProps) {
  const { visible, completed } = useMemo(() => {
    const today = toLocalDateKey();
    const scheduled = tasks.filter((t) => t.scheduledDate === today);
    const pool = scheduled.length > 0 ? scheduled : tasks;
    const v = pool.slice(0, 5);
    return { visible: v, completed: v.filter((t) => t.completed).length };
  }, [tasks]);

  return (
    <div className="bg-surface-sunken border border-edge rounded-3xl p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardList size={16} className="text-ink-muted shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-ink font-fredoka truncate">Today's Quests</h3>
        </div>
        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider shrink-0">
          {completed} Completed
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-ink-muted leading-relaxed py-4 text-center">
          No quests yet. Add some in the Quest Log!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onToggleTask(t.id)}
                aria-label={`Toggle ${t.title}`}
                className={`w-full grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 p-2.5 rounded-2xl border transition-all text-left ${
                  t.completed
                    ? "bg-surface border-edge-soft"
                    : "bg-surface border-dashed border-brand/40 hover:border-brand"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    t.completed ? "bg-[#556B55] text-white" : "text-ink-muted"
                  }`}
                >
                  {t.completed ? <Check size={14} strokeWidth={3} /> : <Circle size={16} />}
                </span>
                <span
                  className={`text-xs font-semibold truncate ${
                    t.completed ? "text-ink-muted line-through" : "text-ink"
                  }`}
                >
                  {t.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(TodaysQuestsImpl);
