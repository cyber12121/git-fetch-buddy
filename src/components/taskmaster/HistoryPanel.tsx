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
  onToggle: () => void;
}

export default function HistoryPanel({ stats, history, showHistory, onToggle }: Props) {
  return (
    <div className="mt-10 border-t border-edge pt-8">
      <div
        className="grid grid-cols-4 gap-px bg-edge rounded-2xl overflow-hidden border border-edge mb-4"
        style={{ fontFamily: MONO_FONT }}
      >
        <div className="bg-surface-sunken p-3 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted flex items-center justify-center gap-1">
            <Flame size={10} /> Streak
          </div>
          <div className="text-xl font-bold text-brand tabular-nums mt-1">{stats.streak}d</div>
        </div>
        <div className="bg-surface-sunken p-3 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Today</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.todayFocusSeconds)}</div>
        </div>
        <div className="bg-surface-sunken p-3 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">All time</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.totalFocusSeconds)}</div>
        </div>
        <div className="bg-surface-sunken p-3 text-center">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Best day</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-1">{fmtHistoryDuration(stats.bestDaySeconds)}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="w-full text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted hover:text-ink cursor-pointer flex items-center justify-center gap-1.5 py-2"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className={`inline-block transition-transform ${showHistory ? "rotate-90" : ""}`}>›</span>
        {stats.totalSessions === 0
          ? "no sessions logged yet"
          : `history · ${stats.totalSessions} session${stats.totalSessions === 1 ? "" : "s"}`}
      </button>

      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 max-h-64 overflow-y-auto divide-y divide-edge/60 border border-edge rounded-xl bg-surface-sunken"
          >
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
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="shrink-0">{modeIcon}</span>
                  <span className="flex-1 min-w-0 truncate text-ink">{r.title}</span>
                  <span className="tabular-nums text-ink-muted" style={{ fontFamily: MONO_FONT }}>
                    {fmtHistoryDuration(r.seconds)}
                  </span>
                  <span
                    className="tabular-nums text-ink-muted/70 text-[10px] hidden sm:inline"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {when}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
