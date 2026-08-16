import { ListTodo } from "lucide-react";
import { MONO_FONT } from "./constants";
import type { Task } from "../../types";

interface Props {
  openTasks: Task[];
  onPick: (title: string) => void;
}

export default function QuestPicker({ openTasks, onPick }: Props) {
  if (openTasks.length === 0) return null;
  return (
    <details className="group rounded-3xl border border-edge bg-surface card-shadow overflow-hidden">
      <summary
        className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink cursor-pointer list-none flex items-center justify-center gap-2 py-3 transition-colors"
        style={{ fontFamily: MONO_FONT }}
      >
        <ListTodo size={12} />
        pick from {openTasks.length} open quest{openTasks.length === 1 ? "" : "s"}
      </summary>
      <ul className="border-t border-edge max-h-56 overflow-y-auto divide-y divide-edge/60">
        {openTasks.map((task) => (
          <li key={task.id}>
            <button
              id={`quick-pick-task-${task.id}`}
              onClick={() => onPick(task.title)}
              className="w-full text-left text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken px-4 py-2.5 transition-colors cursor-pointer truncate"
            >
              {task.title}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
