import { memo } from "react";
import type { Task } from "../../types";
import GubbyCompanion from "../GubbyCompanion";
import TodaysQuests from "../TodaysQuests";
import type { GubbyMood } from "../../hooks/useGubbyState";

interface Props {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  showGubby: boolean;
  gubbyHidden: boolean;
  gubbyMood: GubbyMood;
  gubbyMessage: string;
  xp: number;
  onHideGubby: () => void;
  onShowGubby: () => void;
}

/**
 * Right-hand desktop rail: Sprig companion (or a small "bring me back"
 * button when hidden) and Today's Quests. The reward panel lives inside
 * Settings now — it doesn't belong on every module page.
 */
function RightAsideImpl(p: Props) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 w-80 shrink-0">
      {p.showGubby && (!p.gubbyHidden ? (
        <GubbyCompanion
          mood={p.gubbyMood}
          customMessage={p.gubbyMessage}
          xp={p.xp}
          onHide={p.onHideGubby}
        />
      ) : (
        <button
          type="button"
          onClick={p.onShowGubby}
          className="text-xs font-bold text-ink-muted hover:text-brand bg-surface border border-edge rounded-full px-3 py-2 shadow-sm self-end"
        >
          🦦 Bring Sprig back
        </button>
      ))}
      <TodaysQuests tasks={p.tasks} onToggleTask={p.onToggleTask} />
    </aside>
  );
}

export default memo(RightAsideImpl);
