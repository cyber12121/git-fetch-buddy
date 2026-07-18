import { motion, AnimatePresence } from "motion/react";
import { Minimize2, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { formatTime } from "./constants";

interface FullscreenTimerProps {
  timeLeft: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  onClose: () => void;
}

function FlipCard({ value }: { value: string }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl bg-neutral-900 overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)]"
      style={{
        width: "min(38vw, 30vh)",
        height: "min(38vw, 30vh)",
      }}
    >
      {/* center divider */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-black/80 z-20 -translate-y-[1px]" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="font-bold tabular-nums text-neutral-100 select-none"
          style={{
            fontSize: "min(24vw, 20vh)",
            lineHeight: 1,
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            letterSpacing: "-0.04em",
            transformStyle: "preserve-3d",
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function FullscreenTimer({
  timeLeft,
  isRunning,
  onToggle,
  onReset,
  onClose,
}: FullscreenTimerProps) {
  const [mm, ss] = formatTime(timeLeft).split(":");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); onToggle(); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onToggle]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
      role="dialog"
      aria-label="Fullscreen focus timer"
    >
      <button
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors cursor-pointer"
      >
        <Minimize2 size={16} />
      </button>

      <div className="flex items-center gap-4 sm:gap-6" style={{ perspective: 1000 }}>
        <FlipCard value={mm} />
        <FlipCard value={ss} />
      </div>

      <div className="mt-14 flex items-center gap-3">
        <button
          onClick={onToggle}
          className="px-8 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-100 text-sm font-semibold tracking-wide transition-colors cursor-pointer"
        >
          {isRunning ? "Pause" : "Resume"}
        </button>
        <button
          onClick={onReset}
          aria-label="Reset"
          className="h-12 w-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </motion.div>
  );
}
