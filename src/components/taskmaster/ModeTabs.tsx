import { Coffee, Target, Timer, Wind } from "lucide-react";
import { motion } from "motion/react";
import { MONO_FONT, type TimerMode } from "./constants";

interface Props {
  mode: TimerMode;
  onSwitchMode: (m: TimerMode) => void;
  onBreathe: () => void;
}

const TABS = [
  { id: "focus" as const, label: "Focus", Icon: Target, hint: "Deep work" },
  { id: "pomodoro" as const, label: "Pomo", Icon: Timer, hint: "25 / 5" },
  { id: "break" as const, label: "Break", Icon: Coffee, hint: "Recharge" },
];

export default function ModeTabs({ mode, onSwitchMode, onBreathe }: Props) {
  return (
    <div
      className="mb-8 mx-auto max-w-xl"
      style={{ fontFamily: MONO_FONT }}
    >
      <div
        role="tablist"
        aria-label="Timer mode"
        className="relative flex items-stretch gap-1 p-1.5 rounded-2xl bg-surface-sunken/70 border border-edge backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        {TABS.map(({ id, label, Icon, hint }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSwitchMode(id)}
              title={hint}
              className={`relative flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] transition-colors cursor-pointer ${
                active ? "text-primary-foreground" : "text-ink-muted hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mode-tab-active"
                  className="absolute inset-0 rounded-xl bg-brand shadow-[0_6px_20px_-8px_var(--color-brand,theme(colors.orange.500))]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Icon size={13} strokeWidth={2.4} />
                <span>{label}</span>
              </span>
            </button>
          );
        })}

        <div className="w-px my-2 bg-edge" aria-hidden />

        <button
          type="button"
          onClick={onBreathe}
          title="4-2-6 breathing"
          className="group relative flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted hover:text-ink cursor-pointer transition-colors"
        >
          <span className="absolute inset-0 rounded-xl bg-ink/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
          <Wind size={13} strokeWidth={2.4} className="relative animate-pulse [animation-duration:3s]" />
          <span className="relative hidden sm:inline">Breathe</span>
        </button>
      </div>
    </div>
  );
}
