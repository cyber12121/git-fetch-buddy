import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, Minus, Plus } from "lucide-react";

interface BreathingOverlayProps {
  onClose: () => void;
  onComplete: (seconds: number) => void;
  monoFont: string;
}

// 4-2-6 breathing: inhale 4s → hold 2s → exhale 6s.
// Great for calming an overactive mind.
const PHASES: { label: string; seconds: number }[] = [
  { label: "inhale", seconds: 4 },
  { label: "hold", seconds: 2 },
  { label: "exhale", seconds: 6 },
];
const TICK_MS = 100;
const MIN_ROUNDS = 5;
const MAX_ROUNDS = 10;
const DEFAULT_ROUNDS = 6;

export default function BreathingOverlay({ onClose, onComplete, monoFont }: BreathingOverlayProps) {
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [started, setStarted] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [done, setDone] = useState(false);

  const phase = PHASES[phaseIndex];
  const remaining = Math.max(0, phase.seconds - Math.floor(elapsedMs / 1000));

  useEffect(() => {
    if (!started || done) return;
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
  }, [phase.seconds, started, done]);

  useEffect(() => {
    if (started && !done && cycle >= rounds) {
      setDone(true);
      onComplete(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    }
  }, [cycle, rounds, started, done, onComplete, startedAt]);

  const startNow = () => {
    setStartedAt(Date.now());
    setCycle(0);
    setPhaseIndex(0);
    setElapsedMs(0);
    setDone(false);
    setStarted(true);
  };

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
        4 · 2 · 6 breathing
      </div>

      {!started ? (
        <>
          <p className="text-sm text-ink text-center max-w-sm mt-2 mb-6">
            Calms an overactive mind. Inhale through your nose for <b>4s</b>, hold for <b>2s</b>,
            exhale slowly through your mouth for <b>6s</b>.
          </p>

          {/* Rounds picker */}
          <div className="flex items-center gap-3 mb-8" style={{ fontFamily: monoFont }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted">
              rounds
            </span>
            <button
              onClick={() => setRounds((r) => Math.max(MIN_ROUNDS, r - 1))}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer"
              aria-label="Fewer rounds"
            >
              <Minus size={14} />
            </button>
            <span className="text-2xl font-bold text-ink tabular-nums w-10 text-center">
              {rounds}
            </span>
            <button
              onClick={() => setRounds((r) => Math.min(MAX_ROUNDS, r + 1))}
              className="h-8 w-8 flex items-center justify-center rounded-full border border-edge text-ink-muted hover:text-ink hover:bg-surface-sunken cursor-pointer"
              aria-label="More rounds"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={startNow}
            className="h-16 w-16 flex items-center justify-center rounded-full bg-brand text-primary-foreground hover:bg-brand-hover active:scale-95 transition-all cursor-pointer"
            style={{ boxShadow: "var(--theme-glow)" }}
            aria-label="Start breathing"
          >
            <Play size={24} className="fill-current ml-0.5" />
          </button>
          <div
            className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-ink-muted"
            style={{ fontFamily: monoFont }}
          >
            tap to begin
          </div>
        </>
      ) : (
        <>
          <div className="text-[10px] text-ink-muted mb-10" style={{ fontFamily: monoFont }}>
            cycle {Math.min(cycle + 1, rounds)} / {rounds}
          </div>

          <div className="relative w-72 h-72 flex items-center justify-center">
            <motion.div
              key={phase.label + "-" + cycle}
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
            In through the nose for 4, hold for 2, out through the mouth for 6.
          </p>
        </>
      )}
    </motion.div>
  );
}
