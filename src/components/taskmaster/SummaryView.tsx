import { CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { formatFocusDuration, getGubbyResponse } from "./constants";

interface Props {
  sessionFocusSeconds: number;
  completedMissions: string[];
  onBack: () => void;
  onResetDay: () => void;
}

export default function SummaryView({ sessionFocusSeconds, completedMissions, onBack, onResetDay }: Props) {
  return (
    <div id="taskmaster-summary-module" className="max-w-2xl mx-auto px-1 sm:px-0 pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">Session recap</div>
          <h1 className="text-3xl font-fredoka font-bold text-ink mt-1">Nice work.</h1>
        </div>

        <div className="grid grid-cols-2 gap-px bg-edge rounded-2xl overflow-hidden border border-edge">
          <div className="bg-surface-sunken p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Focused</div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} className="text-4xl font-bold text-ink tabular-nums mt-2">
              {formatFocusDuration(sessionFocusSeconds)}
            </div>
          </div>
          <div className="bg-surface-sunken p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Cleared</div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} className="text-4xl font-bold text-ink tabular-nums mt-2">
              {completedMissions.length}
            </div>
          </div>
        </div>

        {completedMissions.length > 0 && (
          <ul className="space-y-2">
            {completedMissions.map((title, i) => (
              <motion.li
                key={`${i}-${title}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2.5 text-sm text-ink"
              >
                <CheckCircle size={14} className="text-success shrink-0" />
                <span className="truncate">{title}</span>
              </motion.li>
            ))}
          </ul>
        )}

        <p className="text-sm text-ink-muted leading-relaxed border-l-2 border-brand pl-4">
          {getGubbyResponse(sessionFocusSeconds, completedMissions.length)}
        </p>

        <div className="flex gap-2">
          <button
            id="summary-back-btn"
            onClick={onBack}
            className="flex-1 h-12 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-sm rounded-xl transition-all cursor-pointer"
            style={{ boxShadow: "var(--theme-glow)" }}
          >
            Back to timer
          </button>
          <button
            id="summary-reset-session-btn"
            onClick={() => {
              if (window.confirm("Reset all focus stats for today?")) onResetDay();
            }}
            className="px-5 h-12 bg-surface-sunken hover:bg-surface-raised text-ink-muted font-bold text-sm rounded-xl border border-edge cursor-pointer"
          >
            Reset day
          </button>
        </div>
      </motion.div>
    </div>
  );
}
