import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, Play } from "lucide-react";
import type { Task } from "../../types";
import { estimateTaskDuration } from "../../lib/constants";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface Props {
  top3Today: Task[];
  onFocusTask: (title: string, subtaskTitle?: string, taskId?: string, subtaskId?: string) => void;
  onFocusAndSwitch?: (title: string, taskId?: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
}

const priorityEmoji = (p: Task["priority"]) => (p === "low" ? "🟢" : p === "medium" ? "🟡" : "🔴");

/**
 * "Next up" hero card: features the top-priority uncompleted task
 * scheduled for today, with quick pills for the runners-up.
 */
function TodayHeroImpl(p: Props) {
  const hero = p.top3Today[0];

  return (
    <AnimatePresence mode="wait">
      {hero && (
        <motion.div
          key={hero.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="relative overflow-hidden bg-surface-sunken border border-edge rounded-2xl p-5 sm:p-6 mb-5 card-shadow"
          style={{ boxShadow: "var(--theme-glow)" }}
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand to-brand-hover" />
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" /> Next Up
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-lg sm:text-xl font-fredoka font-bold text-ink leading-tight break-words">
                {hero.title}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted font-semibold">
                <span className="flex items-center gap-1"><Clock size={12} />{hero.estimatedMinutes ?? estimateTaskDuration(hero.title)}m</span>
                <span>·</span>
                <span className="capitalize">{priorityEmoji(hero.priority)} {hero.priority}</span>
                {p.top3Today.length > 1 && <><span>·</span><span>+{p.top3Today.length - 1} queued</span></>}
              </div>
            </div>
            <button
              onClick={() => {
                p.onFocusTask(hero.title, undefined, hero.id);
                p.onFocusAndSwitch?.(hero.title, hero.id);
                p.onGubbyMessage(`Starting "${hero.title}"! You've got this 🎯`, "focused");
              }}
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-primary-foreground font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
              style={{ boxShadow: "var(--theme-glow)" }}
            >
              <Play size={14} className="fill-current" /> Start focus
            </button>
          </div>
          {p.top3Today.length > 1 && (
            <div className="mt-4 pt-3 border-t border-edge-soft flex flex-wrap gap-2">
              {p.top3Today.slice(1).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => {
                    p.onFocusTask(t.title, undefined, t.id);
                    p.onFocusAndSwitch?.(t.title, t.id);
                  }}
                  className="text-xs font-semibold text-ink-muted hover:text-ink bg-surface border border-edge-soft hover:border-brand/40 rounded-lg px-2.5 py-1 transition-all cursor-pointer truncate max-w-[240px]"
                  title={`#${i + 2}: ${t.title}`}
                >
                  <span className="text-brand mr-1 font-bold">#{i + 2}</span>{t.title}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(TodayHeroImpl);
