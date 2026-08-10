import { memo } from "react";
import { Zap, Sparkles, Coffee } from "lucide-react";
import type { Task } from "../../types";
import GubbyCompanion from "../GubbyCompanion";
import TodaysQuests from "../TodaysQuests";
import FocusPlant from "../FocusPlant";
import type { GubbyMood } from "../../hooks/useGubbyState";

interface Props {
  activeTab: string;
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
 * Right-hand desktop rail. Content is tab-aware so no tab has an empty
 * column: focus tab gets the live-growing plant; other "do" tabs get
 * Today's Quests plus a small companion / momentum card.
 */
function RightAsideImpl(p: Props) {
  const isFocus = p.activeTab === "taskmaster";
  const isToday = p.activeTab === "daily";
  const isCompiler = p.activeTab === "compiler";

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

      {isFocus ? (
        <>
          <FocusPlant />
          <FocusTip
            title="Protect the seedling"
            body="One stage at a time. Silence notifications; if you drift, note the thought and come back."
          />
        </>
      ) : (
        <>
          <TodaysQuests tasks={p.tasks} onToggleTask={p.onToggleTask} />
          {isToday && (
            <FocusTip
              icon="zap"
              title="One thing rule"
              body="Pick a single next action from the list. Doing beats deciding."
            />
          )}
          {isCompiler && (
            <FocusTip
              icon="coffee"
              title="Dump, don't sort"
              body="Get it out of your head first. Sprig sorts, prioritizes, and schedules for you after."
            />
          )}
          {!isToday && !isCompiler && (
            <FocusTip
              title="Micro-momentum"
              body="Tiny wins compound. Two minutes on the smallest task counts."
            />
          )}
        </>
      )}
    </aside>
  );
}

function FocusTip({
  title,
  body,
  icon = "sparkles",
}: {
  title: string;
  body: string;
  icon?: "sparkles" | "zap" | "coffee";
}) {
  const Icon = icon === "zap" ? Zap : icon === "coffee" ? Coffee : Sparkles;
  return (
    <article className="relative overflow-hidden rounded-3xl border border-edge bg-surface p-4 card-shadow">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(240px 120px at 0% 0%, var(--color-brand-soft), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-1.5 mb-2">
        <Icon size={12} className="text-brand" aria-hidden="true" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-muted">
          {title}
        </p>
      </div>
      <p className="relative text-[12px] text-ink leading-snug">{body}</p>
    </article>
  );
}

export default memo(RightAsideImpl);
