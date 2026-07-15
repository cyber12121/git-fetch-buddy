import { Minus, Plus } from "lucide-react";
import { MONO_FONT, clampMin, type DurationSettings, type TimerMode } from "./constants";

interface Props {
  mode: TimerMode;
  pomoPhase: "focus" | "break";
  settings: DurationSettings;
  onChange: (updater: (s: DurationSettings) => DurationSettings) => void;
}

export default function DurationAdjuster({ mode, pomoPhase, settings, onChange }: Props) {
  const cfg =
    mode === "focus"
      ? { key: "focusMinutes" as const, label: "focus", min: 5, max: 180, step: 5 }
      : mode === "break"
      ? { key: "breakMinutes" as const, label: "break", min: 1, max: 60, step: 1 }
      : pomoPhase === "focus"
      ? { key: "pomoFocusMinutes" as const, label: "pomo focus", min: 5, max: 90, step: 5 }
      : { key: "pomoBreakMinutes" as const, label: "pomo break", min: 1, max: 30, step: 1 };
  const value = settings[cfg.key];
  const bump = (delta: number) => {
    const next = clampMin(value + delta, cfg.min, cfg.max, value);
    onChange((s) => ({ ...s, [cfg.key]: next }));
  };
  return (
    <div className="flex items-center justify-center gap-3 mb-6" style={{ fontFamily: MONO_FONT }}>
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">{cfg.label}</span>
      <button
        type="button"
        onClick={() => bump(-cfg.step)}
        className="h-7 w-7 flex items-center justify-center rounded-full border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer"
        aria-label={`Decrease ${cfg.label} by ${cfg.step} min`}
      >
        <Minus size={12} />
      </button>
      <span className="text-sm font-bold text-ink tabular-nums w-14 text-center">{value}m</span>
      <button
        type="button"
        onClick={() => bump(cfg.step)}
        className="h-7 w-7 flex items-center justify-center rounded-full border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer"
        aria-label={`Increase ${cfg.label} by ${cfg.step} min`}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
