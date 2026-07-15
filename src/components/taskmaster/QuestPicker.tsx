import { MONO_FONT } from "./constants";
import type { Task } from "../../types";

interface Props {
  openTasks: Task[];
  onPick: (title: string) => void;
}

export default function QuestPicker({ openTasks, onPick }: Props) {
  if (openTasks.length === 0) return null;
  return (
    <details className="mt-8 group">
      <summary
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink cursor-pointer list-none flex items-center justify-center gap-1.5"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className="group-open:rotate-90 transition-transform inline-block">›</span>
        or pick from {openTasks.length} open quest{openTasks.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-4 space-y-1 max-h-56 overflow-y-auto">
        {openTasks.map((task) => (
          <li key={task.id}>
            <button
              id={`quick-pick-task-${task.id}`}
              onClick={() => onPick(task.title)}
              className="w-full text-left text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-lg px-3 py-2 transition-colors cursor-pointer truncate"
            >
              {task.title}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
