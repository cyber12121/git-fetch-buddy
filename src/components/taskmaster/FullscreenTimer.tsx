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

function FlipDigit({ digit }: { digit: string }) {
  return (
    <div
      className="relative rounded-xl bg-neutral-900 overflow-hidden shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)]"
      style={{
        width: "min(14vw, 14vh)",
        height: "min(20vw, 20vh)",
        perspective: 600,
      }}
    >
      {/* seam removed for a cleaner look */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={digit}
          initial={{ rotateX: -80, opacity: 0, y: "-8%" }}
          animate={{ rotateX: 0, opacity: 1, y: 0 }}
          exit={{ rotateX: 70, opacity: 0, y: "6%" }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0.28, 1] }}
          className="absolute inset-0 flex items-center justify-center font-bold tabular-nums text-neutral-100 select-none"
          style={{
            fontSize: "min(16vw, 16vh)",
            lineHeight: 1,
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            letterSpacing: "-0.05em",
            transformOrigin: "center",
            backfaceVisibility: "hidden",
          }}
        >
          {digit}
        </motion.div>
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
  const digits = [mm[0], mm[1], ss[0], ss[1]];

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

      <div className="flex items-center gap-2 sm:gap-3">
        <FlipDigit digit={digits[0]} />
        <FlipDigit digit={digits[1]} />
        <div
          className="font-bold text-neutral-500 select-none"
          style={{ fontSize: "min(14vw, 14vh)", lineHeight: 1 }}
        >
          :
        </div>
        <FlipDigit digit={digits[2]} />
        <FlipDigit digit={digits[3]} />
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
