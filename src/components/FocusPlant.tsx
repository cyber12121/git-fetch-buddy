import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sprout } from "lucide-react";
import { computeStats, loadHistory } from "../lib/focusHistory";

interface Props {
  /** Compact stat row + smaller pot for the aside. */
  compact?: boolean;
}

// Growth stages keyed on total focused seconds today (+ live current session).
// Each stage crossed feels like a real reward — new leaves, buds, a flower.
const STAGES: Array<{ at: number; label: string; hint: string }> = [
  { at: 0,     label: "Seed",     hint: "Plant your focus. Start a timer to sprout." },
  { at: 60,    label: "Sprout",   hint: "It's alive. First minute in the bag." },
  { at: 5 * 60,  label: "Seedling", hint: "Roots are gripping. Five minutes done." },
  { at: 15 * 60, label: "Leafy",    hint: "New leaves. Fifteen minutes deep." },
  { at: 25 * 60, label: "Bud",      hint: "A bud forms. One pomodoro complete." },
  { at: 45 * 60, label: "Bloom",    hint: "Petals opening. Real momentum today." },
  { at: 90 * 60, label: "Full bloom", hint: "Fully grown. Legendary focus day." },
];

function stageFor(seconds: number) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (seconds >= STAGES[i].at) idx = i;
  const cur = STAGES[idx];
  const next = STAGES[idx + 1];
  const progress = next ? Math.min(1, (seconds - cur.at) / (next.at - cur.at)) : 1;
  return { idx, cur, next, progress };
}

function fmt(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

/**
 * FocusPlant — a live-growing plant that reflects today's total focused
 * minutes plus the seconds ticking inside the currently-running session.
 * Purely visual reward loop for ADHD brains: watch the thing grow while
 * you work, cross a stage, get a tiny burst of dopamine.
 */
export default function FocusPlant({ compact = false }: Props) {
  const [persistedToday, setPersistedToday] = useState(0);
  const [liveSession, setLiveSession] = useState(0);
  const lastTick = useRef<number>(0);
  const prevStageRef = useRef<number>(-1);
  const [bumpKey, setBumpKey] = useState(0);

  // Read persisted today total on mount + refresh every 15s so completed
  // sessions from other tabs eventually show up.
  useEffect(() => {
    const read = () => {
      try {
        setPersistedToday(computeStats(loadHistory()).todayFocusSeconds);
      } catch { /* ignore */ }
    };
    read();
    const t = window.setInterval(read, 15_000);
    return () => window.clearInterval(t);
  }, []);

  // Subscribe to live focus-tick events dispatched by the Focus timer.
  useEffect(() => {
    const onTick = (e: Event) => {
      const detail = (e as CustomEvent<{ seconds: number }>).detail;
      if (!detail) return;
      lastTick.current = Date.now();
      setLiveSession(detail.seconds);
    };
    window.addEventListener("momentum:focus-tick", onTick);

    // Drop the live-session boost if no tick arrives for ~3s (timer stopped
    // or session ended). Persisted total will absorb it on the next read.
    const watchdog = window.setInterval(() => {
      if (lastTick.current && Date.now() - lastTick.current > 3500) {
        setLiveSession(0);
        lastTick.current = 0;
        // Force a persistedToday refresh a beat after the session ends.
        try {
          setPersistedToday(computeStats(loadHistory()).todayFocusSeconds);
        } catch { /* ignore */ }
      }
    }, 1000);

    return () => {
      window.removeEventListener("momentum:focus-tick", onTick);
      window.clearInterval(watchdog);
    };
  }, []);

  const totalSeconds = persistedToday + liveSession;
  const { idx, cur, next, progress } = useMemo(() => stageFor(totalSeconds), [totalSeconds]);

  // Little celebration bounce when we cross into a new stage.
  useEffect(() => {
    if (prevStageRef.current === -1) {
      prevStageRef.current = idx;
      return;
    }
    if (idx > prevStageRef.current) {
      prevStageRef.current = idx;
      setBumpKey((k) => k + 1);
    }
  }, [idx]);

  const secondsToNext = next ? Math.max(0, next.at - totalSeconds) : 0;

  return (
    <section
      aria-label="Focus plant"
      className="rounded-3xl border border-edge bg-surface p-4 card-shadow overflow-hidden relative"
    >
      {/* Soft sky gradient behind the plant */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--accent) 18%, transparent), transparent 55%), radial-gradient(180px 100px at 50% 100%, var(--color-brand-soft), transparent 70%)",
        }}
      />

      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sprout size={12} className="text-brand" aria-hidden="true" />
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Focus plant
          </p>
        </div>
        <span className="text-[10px] font-bold text-ink-muted tabular-nums">
          {fmt(totalSeconds)} today
        </span>
      </div>

      <motion.div
        key={bumpKey}
        initial={{ scale: 0.94 }}
        animate={{ scale: [0.94, 1.06, 1] }}
        transition={{ duration: 0.6, times: [0, 0.4, 1] }}
        className="relative flex items-end justify-center"
        style={{ height: compact ? 140 : 168 }}
      >
        <PlantSVG stageIdx={idx} progress={progress} />
      </motion.div>

      <div className="relative mt-3">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-sm font-extrabold text-ink font-fredoka">
            {cur.label}
          </p>
          {next && (
            <span className="text-[10px] font-bold text-ink-muted tabular-nums">
              {fmt(secondsToNext)} to {next.label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-ink-muted leading-snug min-h-[2.5em]">
          {cur.hint}
        </p>

        {next && (
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Growth toward ${next.label}`}
            className="mt-2 h-1.5 rounded-full bg-surface-sunken overflow-hidden"
          >
            <motion.div
              initial={false}
              animate={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-brand), var(--accent))",
              }}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {liveSession > 0 && (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative mt-3 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-brand"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand" />
            </span>
            growing · {fmt(liveSession)} this session
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SVG plant. Parts fade/scale in based on stage index; blooms tint peach.   */
/* -------------------------------------------------------------------------- */

function PlantSVG({ stageIdx, progress }: { stageIdx: number; progress: number }) {
  // Sway animation intensifies slightly as it grows.
  const sway = 1 + Math.min(stageIdx, 4) * 0.6;
  return (
    <svg
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      className="max-w-[220px]"
      aria-hidden="true"
    >
      {/* Pot */}
      <defs>
        <linearGradient id="pot-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-brand-hover)" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="stem-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <radialGradient id="bloom-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="var(--color-brand)" />
        </radialGradient>
      </defs>

      {/* Soil */}
      <ellipse cx="100" cy="168" rx="42" ry="6" fill="#5b3a1e" opacity="0.85" />
      {/* Pot body */}
      <path
        d="M60 168 L64 196 Q64 200 68 200 L132 200 Q136 200 136 196 L140 168 Z"
        fill="url(#pot-grad)"
      />
      <ellipse cx="100" cy="168" rx="40" ry="5" fill="rgba(0,0,0,0.15)" />

      {/* Seed stage — a tiny sprout dot in the soil */}
      {stageIdx === 0 && (
        <motion.circle
          cx="100"
          cy="166"
          r="3"
          fill="#84cc16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 + progress * 0.6 }}
        />
      )}

      {/* Stem — appears from sprout onward, grows with stage */}
      {stageIdx >= 1 && (
        <motion.rect
          x="97"
          y={165 - (30 + stageIdx * 14)}
          width="6"
          height={30 + stageIdx * 14}
          rx="3"
          fill="url(#stem-grad)"
          initial={{ scaleY: 0.4, opacity: 0 }}
          animate={{
            scaleY: 1,
            opacity: 1,
            rotate: [0, sway * 0.6, -sway * 0.6, 0],
          }}
          style={{ transformOrigin: "100px 165px" }}
          transition={{
            scaleY: { type: "spring", stiffness: 90, damping: 18 },
            opacity: { duration: 0.4 },
            rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}

      {/* First pair of leaves */}
      {stageIdx >= 2 && (
        <>
          <motion.ellipse
            cx="80"
            cy="140"
            rx="18"
            ry="9"
            fill="#4ade80"
            transform="rotate(-25 80 140)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
          />
          <motion.ellipse
            cx="120"
            cy="140"
            rx="18"
            ry="9"
            fill="#22c55e"
            transform="rotate(25 120 140)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.05 }}
          />
        </>
      )}

      {/* Second pair (higher, larger) */}
      {stageIdx >= 3 && (
        <>
          <motion.ellipse
            cx="72"
            cy="112"
            rx="22"
            ry="11"
            fill="#22c55e"
            transform="rotate(-30 72 112)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
          />
          <motion.ellipse
            cx="128"
            cy="112"
            rx="22"
            ry="11"
            fill="#16a34a"
            transform="rotate(30 128 112)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.05 }}
          />
        </>
      )}

      {/* Bud */}
      {stageIdx >= 4 && (
        <motion.circle
          cx="100"
          cy={stageIdx >= 5 ? 78 : 88}
          r={stageIdx >= 5 ? 8 : 6}
          fill="var(--color-brand)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        />
      )}

      {/* Bloom — 5 petals + center */}
      {stageIdx >= 5 && (
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: [0, 4, -4, 0] }}
          transition={{
            scale: { type: "spring", stiffness: 140, damping: 14 },
            opacity: { duration: 0.4 },
            rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ transformOrigin: "100px 66px" }}
        >
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="100"
              cy="52"
              rx="10"
              ry="16"
              fill="url(#bloom-grad)"
              transform={`rotate(${deg} 100 66)`}
              opacity={0.95}
            />
          ))}
          <circle cx="100" cy="66" r="7" fill="#fde68a" />
        </motion.g>
      )}

      {/* Full bloom — extra petals + sparkle dots */}
      {stageIdx >= 6 && (
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 140, damping: 14 }}
        >
          {[36, 108, 180, 252, 324].map((deg) => (
            <ellipse
              key={deg}
              cx="100"
              cy="46"
              rx="8"
              ry="13"
              fill="#fdba74"
              transform={`rotate(${deg} 100 66)`}
              opacity={0.9}
            />
          ))}
          <circle cx="72" cy="46" r="2" fill="var(--color-brand)" opacity="0.6" />
          <circle cx="130" cy="52" r="1.5" fill="var(--color-brand)" opacity="0.5" />
          <circle cx="115" cy="34" r="2" fill="#fbbf24" opacity="0.7" />
        </motion.g>
      )}
    </svg>
  );
}
