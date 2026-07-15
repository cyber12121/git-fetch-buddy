import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface BreathingOverlayProps {
  onClose: () => void;
  onComplete: (seconds: number) => void;
  monoFont: string;
}

// Slow calming breath: inhale 4s → hold 7s → exhale 8s (classic 4-7-8).
// ADHD-friendly, downshifts the nervous system.
const CYCLES = 4;
const PHASES: { label: string; seconds: number }[] = [
  { label: "inhale", seconds: 4 },
  { label: "hold", seconds: 7 },
  { label: "exhale", seconds: 8 },
];
const TICK_MS = 100; // smooth sub-second countdown for slow phases

export default function BreathingOverlay({ onClose, onComplete, monoFont }: BreathingOverlayProps) {
  const [cycle, setCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt] = useState(() => Date.now());

  const phase = PHASES[phaseIndex];
  const remaining = Math.max(0, phase.seconds - Math.floor(elapsedMs / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs((ms) => {
        const next = ms + TICK_MS;
        if (next >= phase.seconds * 1000) {
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
    }, TICK_MS);
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
        4 · 7 · 8 breathing
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
            {remaining}
          </div>
        </div>
      </div>

      <p className="mt-10 text-xs text-ink-muted text-center max-w-xs">
        Breathe in for 4, hold for 7, release for 8. Slow, deep, calming.
      </p>
    </motion.div>
  );
}
