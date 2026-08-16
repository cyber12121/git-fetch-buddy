import { Coffee, Flame, Target, Timer, Wind } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatDuration as fmtHistoryDuration, type SessionRecord } from "../../lib/focusHistory";
import { MONO_FONT } from "./constants";

interface Stats {
  streak: number;
  todayFocusSeconds: number;
  totalFocusSeconds: number;
  bestDaySeconds: number;
  totalSessions: number;
}

interface Props {
  stats: Stats;
  history: SessionRecord[];
  showHistory: boolean;
  cleared: number;
  onToggle: () => void;
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-muted flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums mt-1 ${accent ? "text-brand" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function HistoryPanel({ stats, history, showHistory, cleared, onToggle }: Props) {
  return (
    <section
      aria-label="Focus stats and history"
      className="rounded-3xl border border-edge bg-surface card-shadow overflow-hidden"
      style={{ fontFamily: MONO_FONT }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-edge">
        <Stat label="Today" value={fmtHistoryDuration(stats.todayFocusSeconds)} />
        <Stat label="Cleared" value={String(cleared)} />
        <Stat label="Streak" value={`${stats.streak}d`} accent icon={<Flame size={10} />} />
        <Stat label="Best day" value={fmtHistoryDuration(stats.bestDaySeconds)} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="w-full border-t border-edge text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer flex items-center justify-center gap-1.5 py-3 transition-colors"
      >
        <span className={`inline-block transition-transform ${showHistory ? "rotate-90" : ""}`}>›</span>
        {stats.totalSessions === 0
          ? "no sessions logged yet"
          : `history · ${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"}`}
      </button>

      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-edge bg-surface-sunken"
          >
            {history.length === 0 ? (
              <p className="px-4 py-4 text-center text-[11px] text-ink-muted">
                Sessions ≥ 10 min count toward your streak.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto divide-y divide-edge/60">
                {[...history].reverse().slice(0, 40).map((r) => {
                  const d = new Date(r.at);
                  const when =
                    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                    " " +
                    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  const modeIcon =
                    r.mode === "focus" ? <Target size={11} className="text-brand" /> :
                    r.mode === "pomodoro" ? <Timer size={11} className="text-brand" /> :
                    r.mode === "break" ? <Coffee size={11} className="text-ink-muted" /> :
                    <Wind size={11} className="text-accent" />;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                      <span className="shrink-0">{modeIcon}</span>
                      <span className="flex-1 min-w-0 truncate text-ink">{r.title}</span>
                      <span className="tabular-nums text-ink-muted">{fmtHistoryDuration(r.seconds)}</span>
                      <span className="tabular-nums text-ink-muted/70 text-[10px] hidden sm:inline">{when}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
