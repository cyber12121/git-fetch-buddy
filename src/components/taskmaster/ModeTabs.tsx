import { Coffee, Target, Timer, Wind } from "lucide-react";
import { MONO_FONT, type TimerMode } from "./constants";

interface Props {
  mode: TimerMode;
  onSwitchMode: (m: TimerMode) => void;
  onBreathe: () => void;
}

const TABS = [
  { id: "focus" as const, label: "Focus", Icon: Target },
  { id: "pomodoro" as const, label: "Pomodoro", Icon: Timer },
  { id: "break" as const, label: "Break", Icon: Coffee },
];

export default function ModeTabs({ mode, onSwitchMode, onBreathe }: Props) {
  return (
    <div
      className="flex items-center justify-center gap-1 mb-8 p-1 bg-surface-sunken border border-edge rounded-full max-w-md mx-auto"
      style={{ fontFamily: MONO_FONT }}
      role="tablist"
      aria-label="Timer mode"
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSwitchMode(id)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
              active ? "bg-brand text-primary-foreground" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icon size={11} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onBreathe}
        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-ink cursor-pointer border-l border-edge ml-1"
        title="4-2-6 breathing"
      >
        <Wind size={11} />
        <span className="hidden sm:inline">Breathe</span>
      </button>
    </div>
  );
}
