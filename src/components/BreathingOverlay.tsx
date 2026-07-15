import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface BreathingOverlayProps {
  onClose: () => void;
  onComplete: (seconds: number) => void;
  monoFont: string;
}

// 3-2-1 breathing: inhale 3s → hold 2s → exhale 1s. Repeat for N cycles.
// Small, non-frightening, ADHD-friendly regulation micro-tool.
const CYCLES = 6;
const PHASES: { label: string; seconds: number }[] = [
  { label: "inhale", seconds: 3 },
  { label: "hold", seconds: 2 },
  { label: "exhale", seconds: 1 },
];

export default function BreathingOverlay({ onClose, onComplete, monoFont }: BreathingOverlayProps) {
  const [cycle, setCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [startedAt] = useState(() => Date.now());

  const phase = PHASES[phaseIndex];

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        if (next >= phase.seconds) {
          setPhaseIndex((pi) => {
            const nextPi = pi + 1;
            if (nextPi >= PHASES.length) {
              setCycle((c) => c + 1);
              return 0;
            }
            return nextPi;
          });
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase.seconds]);

  useEffect(() => {
    if (cycle >= CYCLES) {
      onComplete(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }
  }, [cycle, onComplete, startedAt]);

  const scale = phase.label === "inhale" ? 1.6 : phase.label === "hold" ? 1.6 : 0.7;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-canvas/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6"
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer"
        aria-label="Close breathing"
      >
        <X size={18} />
      </button>

      <div
        className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted mb-2"
        style={{ fontFamily: monoFont }}
      >
        3 · 2 · 1 breathing
      </div>
      <div className="text-[10px] text-ink-muted mb-10" style={{ fontFamily: monoFont }}>
        cycle {Math.min(cycle + 1, CYCLES)} / {CYCLES}
      </div>

      <div className="relative w-72 h-72 flex items-center justify-center">
        <motion.div
          key={phase.label}
          animate={{ scale }}
          transition={{ duration: phase.seconds, ease: "easeInOut" }}
          className="absolute w-56 h-56 rounded-full bg-brand/20 border border-brand/40"
        />
        <div className="relative z-10 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-3xl font-bold text-ink uppercase tracking-widest"
              style={{ fontFamily: monoFont }}
            >
              {phase.label}
            </motion.div>
          </AnimatePresence>
          <div
            className="text-6xl font-bold text-brand tabular-nums mt-2"
            style={{ fontFamily: monoFont }}
          >
            {phase.seconds - tick}
          </div>
        </div>
      </div>

      <p className="mt-10 text-xs text-ink-muted text-center max-w-xs">
        Breathe in for 3, hold for 2, release for 1. Slow your nervous system down.
      </p>
    </motion.div>
  );
}
