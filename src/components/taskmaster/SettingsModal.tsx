import { X } from "lucide-react";
import { motion } from "motion/react";
import { BODY_FONT, MONO_FONT, DEFAULT_SETTINGS, clampMin, type DurationSettings } from "./constants";

interface Props {
  settings: DurationSettings;
  onChange: (updater: (s: DurationSettings) => DurationSettings) => void;
  onClose: () => void;
  onReset: () => void;
}

const FIELDS = [
  { key: "focusMinutes" as const, label: "Focus", min: 1, max: 180, hint: "Classic deep work" },
  { key: "pomoFocusMinutes" as const, label: "Pomodoro focus", min: 5, max: 90, hint: "One tomato" },
  { key: "pomoBreakMinutes" as const, label: "Pomodoro break", min: 1, max: 30, hint: "Between tomatoes" },
  { key: "breakMinutes" as const, label: "Standalone break", min: 1, max: 60, hint: "Solo pause" },
];

export default function SettingsModal({ settings, onChange, onClose, onReset }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-canvas/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full bg-surface-sunken border border-edge rounded-2xl p-6 space-y-5"
        style={{ fontFamily: BODY_FONT }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted" style={{ fontFamily: MONO_FONT }}>
              Timer settings
            </div>
            <h3 className="text-lg font-bold text-ink mt-0.5">Durations</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-raised cursor-pointer"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {FIELDS.map(({ key, label, min, max, hint }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`setting-${key}`} className="text-xs font-bold text-ink">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  id={`setting-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  value={settings[key]}
                  onChange={(e) => onChange((s) => ({ ...s, [key]: clampMin(e.target.value, min, max, s[key]) }))}
                  className="w-16 h-8 bg-canvas border border-edge rounded-md text-center text-sm font-bold text-ink tabular-nums focus:border-brand outline-none"
                  style={{ fontFamily: MONO_FONT }}
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted" style={{ fontFamily: MONO_FONT }}>min</span>
              </div>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={settings[key]}
              onChange={(e) => onChange((s) => ({ ...s, [key]: parseInt(e.target.value, 10) }))}
              className="w-full accent-[var(--color-brand)] cursor-pointer"
              aria-label={label}
            />
            <div className="text-[10px] text-ink-muted" style={{ fontFamily: MONO_FONT }}>{hint} · {min}–{max}m</div>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onReset}
            className="flex-1 h-10 bg-transparent hover:bg-surface-raised border border-edge text-ink-muted font-bold text-xs rounded-lg cursor-pointer"
          >
            Reset defaults
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 bg-brand hover:bg-brand-hover text-primary-foreground font-bold text-xs rounded-lg cursor-pointer"
            style={{ boxShadow: "var(--theme-glow)" }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export { DEFAULT_SETTINGS };
