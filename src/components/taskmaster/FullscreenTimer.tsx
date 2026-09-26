import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, Pause, RotateCcw } from "lucide-react";
import { formatTime } from "./constants";

interface FullscreenTimerProps {
  timeLeft: number;
  duration?: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  onClose: () => void;
  activeTaskTitle?: string | null;
  pomoRound?: number;
  mode?: "focus" | "pomodoro" | "break";
}

export default function FullscreenTimer({
  timeLeft,
  isRunning,
  onToggle,
  onReset,
  onClose,
  activeTaskTitle,
  pomoRound = 1,
  mode = "focus",
}: FullscreenTimerProps) {
  const [controlsHovered, setControlsHovered] = useState(false);

  // Keyboard controls: Space to play/pause, Escape to exit, R to reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        onToggle();
      }
      if (e.key.toLowerCase() === "r") {
        onReset();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onToggle, onReset]);

  // Digital readout formatted as MM:SS
  const timeFormatted = formatTime(timeLeft);

  // Time Timer geometry & math
  // Dial radius and center coordinates
  const cx = 200;
  const cy = 200;
  const r = 142; // Dial disk radius
  const rNum = 172; // Numbers radius

  // Calculate remaining minutes for 60-min dial
  // If > 60 min, wrap smoothly or show full
  const minutesFloat = Math.max(0, Math.min(60, timeLeft / 60));
  const angleDeg = (minutesFloat / 60) * 360;

  const wedgeColor =
    mode === "break"
      ? pomoRound >= 4
        ? "#8b5cf6"
        : "#10b981"
      : "#ef4444";

  // Compute the red wedge SVG path (counter-clockwise sweep from 12 o'clock)
  const redWedgePath = useMemo(() => {
    if (minutesFloat <= 0.05) return null;
    if (minutesFloat >= 59.95) return "FULL";

    const rad = (angleDeg * Math.PI) / 180;
    const startX = cx;
    const startY = cy - r;
    // Counter-clockwise from 12 o'clock
    const endX = cx - r * Math.sin(rad);
    const endY = cy - r * Math.cos(rad);
    const largeArcFlag = angleDeg > 180 ? 1 : 0;

    // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    // sweep-flag = 0 produces counter-clockwise arc in SVG coordinate space
    return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 0 ${endX} ${endY} Z`;
  }, [minutesFloat, angleDeg]);

  // Ticks generation (60 ticks around the dial)
  const ticks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      const isMajor = i % 5 === 0;
      const rad = (i * 6 * Math.PI) / 180;
      const xOuter = cx - r * Math.sin(rad);
      const yOuter = cy - r * Math.cos(rad);
      const len = isMajor ? 16 : 8;
      const xInner = cx - (r - len) * Math.sin(rad);
      const yInner = cy - (r - len) * Math.cos(rad);

      arr.push({
        i,
        isMajor,
        x1: xOuter,
        y1: yOuter,
        x2: xInner,
        y2: yInner,
        stroke: isMajor ? "#717988" : "#323841",
        strokeWidth: isMajor ? 2 : 1.2,
      });
    }
    return arr;
  }, []);

  // Numbers (0, 5, 10, 15, ..., 55 counter-clockwise)
  const numbers = useMemo(() => {
    const list = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    return list.map((m) => {
      const rad = (m * 6 * Math.PI) / 180;
      const x = cx - rNum * Math.sin(rad);
      const y = cy - rNum * Math.cos(rad);
      return { m, x, y };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[100] bg-[#0a0a0c] flex flex-col items-center justify-center select-none text-white overflow-hidden"
      role="dialog"
      aria-label="Fullscreen Analog Focus Timer"
      onMouseEnter={() => setControlsHovered(true)}
      onMouseLeave={() => setControlsHovered(false)}
    >
      {/* Top right close button (✕) exactly like reference */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="absolute top-6 right-6 sm:top-8 sm:right-8 w-11 h-11 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.12] text-neutral-400 hover:text-white transition-all cursor-pointer z-20"
      >
        <X size={20} strokeWidth={2} />
      </button>

      {/* Main Focus Content Container */}
      <div className="flex flex-col items-center justify-center max-w-lg w-full px-4">
        {/* Active mission title (subtle if active) */}
        {activeTaskTitle && (
          <div className="mb-2 text-xs sm:text-sm font-semibold text-neutral-400 max-w-sm truncate px-3 py-1 rounded-full bg-white/[0.03]">
            {activeTaskTitle}
          </div>
        )}

        {/* Digital Readout: Big bold crisp white time (e.g. 42:48) */}
        <div
          onClick={onToggle}
          className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white tabular-nums mb-8 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
          title={isRunning ? "Click to Pause" : "Click to Resume"}
        >
          {timeFormatted}
        </div>

        {/* ADHD Visual Analog Time Timer Clock */}
        <div
          onClick={onToggle}
          className="relative w-72 h-72 sm:w-88 sm:h-88 md:w-96 md:h-96 cursor-pointer group"
          title={isRunning ? "Click to Pause" : "Click to Resume"}
        >
          <svg
            viewBox="0 0 400 400"
            className="w-full h-full drop-shadow-2xl overflow-visible"
          >
            {/* Background Dial Disk: Deep Dark Charcoal */}
            <circle cx={cx} cy={cy} r={r} fill="#1e2227" />

            {/* Countdown Wedge (Focus Red, Short Break Emerald, Long Break Lavender) */}
            {redWedgePath === "FULL" ? (
              <circle cx={cx} cy={cy} r={r} fill={wedgeColor} />
            ) : redWedgePath ? (
              <path d={redWedgePath} fill={wedgeColor} />
            ) : null}

            {/* Dial Ticks (radial tick marks) */}
            {ticks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.stroke}
                strokeWidth={t.strokeWidth}
                strokeLinecap="round"
              />
            ))}

            {/* Outer Numbers (0, 5, 10, ..., 55 counter-clockwise) */}
            {numbers.map(({ m, x, y }) => (
              <text
                key={m}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#94a3b8"
                fontSize="14"
                fontWeight="600"
                className="select-none font-mono"
              >
                {m}
              </text>
            ))}
          </svg>

          {/* Pause overlay pulse when timer is not running */}
          {!isRunning && timeLeft > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white/80 shadow-lg border border-white/10 animate-pulse">
                <Play size={22} className="fill-current translate-x-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Minimal Controls Bar (visible on hover or when paused) */}
        <div
          className={`mt-8 flex items-center gap-3 transition-opacity duration-200 ${
            controlsHovered || !isRunning ? "opacity-100" : "opacity-0 sm:opacity-40"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 px-6 h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-sm font-semibold text-neutral-200 hover:text-white transition-all cursor-pointer"
          >
            {isRunning ? (
              <>
                <Pause size={14} className="fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>Resume</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset timer"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="Reset timer (R)"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* 4-Stage Pomodoro Garden Tracker */}
        <div className="mt-5 flex flex-col items-center gap-2 select-none">
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4].map((step) => {
              const isCompleted = pomoRound > step;
              const isCurrent = pomoRound === step;
              return (
                <div
                  key={step}
                  className={`flex items-center justify-center w-7 h-7 rounded-full border transition-all ${
                    isCompleted
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-400"
                      : isCurrent
                      ? "bg-amber-950/80 border-amber-500 text-amber-300 scale-110 ring-2 ring-amber-500/30"
                      : "bg-white/5 border-white/10 text-white/20"
                  }`}
                  title={`Round ${step} of 4`}
                >
                  {isCompleted ? (
                    <span className="text-xs">🌸</span>
                  ) : isCurrent ? (
                    <span className="text-xs animate-pulse">🌱</span>
                  ) : (
                    <span className="text-[10px]">⚪</span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
            {mode === "break"
              ? pomoRound >= 4
                ? "🏕️ Deep Recharge in progress"
                : `🍵 Short Break · Round ${pomoRound} of 4`
              : `🍅 Focus Sprint · Round ${pomoRound} of 4`}
          </span>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-3 text-[11px] text-neutral-500 font-mono tracking-wide">
          Space to {isRunning ? "pause" : "resume"} • Esc to close
        </div>
      </div>
    </motion.div>
  );
}
