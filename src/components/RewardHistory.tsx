import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Trash2, Sparkles, Flame, Trophy, Zap, Target } from "lucide-react";
import confetti from "canvas-confetti";
import {
  subscribeRewardHistory,
  clearRewardHistory,
  type RewardEntry,
} from "../lib/rewardHistory";
import { XP_MILESTONES } from "../lib/xpMilestones";

function formatRelative(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const KIND_META: Record<
  RewardEntry["kind"],
  { label: string; ring: string; bg: string; text: string; Icon: typeof Zap }
> = {
  combo: {
    label: "Combo",
    ring: "ring-amber-400/40",
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    text: "text-amber-50",
    Icon: Zap,
  },
  milestone: {
    label: "Milestone",
    ring: "ring-orange-400/40",
    bg: "bg-gradient-to-br from-orange-400 to-rose-500",
    text: "text-orange-50",
    Icon: Target,
  },
  achievement: {
    label: "Achieve",
    ring: "ring-emerald-400/40",
    bg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    text: "text-emerald-50",
    Icon: Trophy,
  },
  levelup: {
    label: "Level up",
    ring: "ring-fuchsia-400/40",
    bg: "bg-gradient-to-br from-fuchsia-500 to-violet-600",
    text: "text-fuchsia-50",
    Icon: Sparkles,
  },
};

/** Read XP from localStorage + subscribe to the storage event so this panel
 *  reflects the live number without prop-drilling through every parent. */
function useLiveXp(): number {
  const [xp, setXp] = useState<number>(0);
  useEffect(() => {
    const read = () => {
      try {
        const n = Number(localStorage.getItem("goblin_xp") || "0");
        if (Number.isFinite(n)) setXp(n);
      } catch { /* ignore */ }
    };
    read();
    const t = window.setInterval(read, 1000); // cheap poll — component is small
    window.addEventListener("storage", read);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("storage", read);
    };
  }, []);
  return xp;
}

interface Props {
  /** Compact = collapsed history by default. */
  defaultOpen?: boolean;
}

export default function RewardHistory({ defaultOpen = false }: Props) {
  const [items, setItems] = useState<RewardEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(defaultOpen);
  const [now, setNow] = useState(() => Date.now());
  const [pulseId, setPulseId] = useState<number | null>(null);

  const xp = useLiveXp();

  useEffect(() => subscribeRewardHistory(setItems), []);

  // Tick every 30s while history is open to refresh relative times.
  useEffect(() => {
    if (!historyOpen) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [historyOpen]);

  // Detect a NEW reward — flash + tiny confetti burst.
  const lastSeenId = useRef<number>(0);
  useEffect(() => {
    const top = items[0];
    if (!top) return;
    if (lastSeenId.current === 0) {
      lastSeenId.current = top.id;
      return;
    }
    if (top.id !== lastSeenId.current) {
      lastSeenId.current = top.id;
      setPulseId(top.id);
      window.setTimeout(() => setPulseId(null), 1400);
      try {
        confetti({
          particleCount: top.kind === "levelup" ? 40 : 18,
          spread: 60,
          startVelocity: 28,
          origin: { y: 0.7 },
          scalar: 0.7,
          colors: ["#ff2d75", "#22d3ee", "#fde047", "#a78bfa"],
        });
      } catch { /* canvas-confetti no-op */ }
    }
  }, [items]);

  // ── XP derived numbers ────────────────────────────────────────────────
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const pctToLevel = Math.min(100, xpInLevel);

  const nextMilestone = useMemo(
    () => XP_MILESTONES.find((m) => m > xp),
    [xp],
  );
  const xpToMilestone = nextMilestone ? nextMilestone - xp : 0;
  const milestonePct = nextMilestone
    ? Math.max(2, Math.round((xp / nextMilestone) * 100))
    : 100;

  // ── Streak = combos within the last 60s ───────────────────────────────
  const streakInfo = useMemo(() => {
    const cutoff = Date.now() - 60_000;
    const recentCombos = items.filter((e) => e.kind === "combo" && e.at >= cutoff);
    return { count: recentCombos.length, hot: recentCombos.length >= 2 };
  }, [items]);

  // Ring geometry
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const dash = (pctToLevel / 100) * CIRC;

  return (
    <section
      aria-label="Reward system"
      className="relative rounded-3xl overflow-hidden border border-edge/70 bg-gradient-to-br from-surface via-surface-sunken to-surface text-ink shadow-sm"
    >
      {/* Ambient glow layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(600px 200px at 90% -20%, var(--color-brand-soft), transparent 60%), radial-gradient(400px 160px at -10% 110%, color-mix(in oklab, var(--accent) 25%, transparent), transparent 60%)",
        }}
      />

      {/* ── Hero: level ring + XP + streak ───────────────────────────── */}
      <div className="relative p-4 flex items-center gap-4">
        {/* Level ring */}
        <div className="relative shrink-0" aria-hidden="true">
          <svg width={84} height={84} className="-rotate-90">
            <circle
              cx={42} cy={42} r={R}
              stroke="var(--color-edge)"
              strokeWidth={7}
              fill="none"
            />
            <motion.circle
              cx={42} cy={42} r={R}
              stroke="var(--color-brand)"
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRC}
              initial={false}
              animate={{ strokeDashoffset: CIRC - dash }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              style={{ filter: "drop-shadow(0 0 6px var(--color-brand))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Lv</span>
            <span className="text-xl font-black text-ink tabular-nums font-fredoka">{level}</span>
          </div>
        </div>

        {/* XP + progress copy */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <motion.span
              key={xp}
              initial={{ scale: 1.4, color: "var(--color-brand)" }}
              animate={{ scale: 1, color: "var(--color-ink)" }}
              transition={{ duration: 0.5 }}
              className="text-2xl font-black tabular-nums font-fredoka"
            >
              {xp}
            </motion.span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">XP</span>
          </div>
          <p className="text-[11px] text-ink-muted mt-0.5">
            <span className="font-bold text-ink tabular-nums">{100 - xpInLevel}</span> to Lv {level + 1}
          </p>
          {nextMilestone && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Target size={10} /> next milestone
                </span>
                <span className="tabular-nums font-bold text-ink">{xpToMilestone} to go</span>
              </div>
              <div className="h-1.5 rounded-full bg-edge overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${milestonePct}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  className="h-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--color-brand), var(--accent))",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Streak / Combo bar ───────────────────────────────────────── */}
      <div className="relative px-4 pb-3">
        <motion.div
          animate={
            streakInfo.hot
              ? { scale: [1, 1.02, 1], boxShadow: [
                  "0 0 0 0 rgba(255,45,117,0)",
                  "0 0 22px 2px color-mix(in oklab, var(--color-brand) 45%, transparent)",
                  "0 0 0 0 rgba(255,45,117,0)",
                ] }
              : {}
          }
          transition={{ duration: 1.2, repeat: streakInfo.hot ? Infinity : 0 }}
          className={`rounded-2xl px-3 py-2 flex items-center gap-2 border ${
            streakInfo.hot
              ? "border-primary/50 bg-primary/10"
              : "border-edge bg-surface-sunken/60"
          }`}
        >
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${
              streakInfo.hot
                ? "bg-gradient-to-br from-orange-400 to-rose-500 text-white"
                : "bg-surface-raised text-ink-muted"
            }`}
            aria-hidden="true"
          >
            <Flame size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-ink leading-tight">
              {streakInfo.hot
                ? `${streakInfo.count + 1}× combo streak — keep going!`
                : "Chain 2 wins in 45s to spark a combo"}
            </p>
            <p className="text-[10px] text-ink-muted leading-tight tabular-nums">
              {streakInfo.hot ? `+${Math.min(streakInfo.count, 5) * 5} XP per link` : "combos = bonus XP"}
            </p>
          </div>
          {streakInfo.hot && (
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-xl"
              aria-hidden="true"
            >
              🔥
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* ── Recent wins ticker (top 3) ───────────────────────────────── */}
      <div className="relative px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">
            Recent wins
          </p>
          <span className="text-[10px] font-bold text-ink-muted tabular-nums">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-[11px] text-ink-muted italic">
            No wins yet — check off a quest and watch this light up ✨
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {items.slice(0, 3).map((e) => {
                const meta = KIND_META[e.kind];
                const isPulse = pulseId === e.id;
                return (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 bg-surface-sunken/70 border border-edge/60 ${
                      isPulse ? `ring-2 ${meta.ring}` : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs ${meta.bg} ${meta.text} shadow`}
                      aria-hidden="true"
                    >
                      <meta.Icon size={13} strokeWidth={2.5} />
                    </span>
                    <p className="text-[11px] font-bold text-ink leading-tight truncate flex-1">
                      {e.message}
                    </p>
                    <span className="text-[10px] text-ink-muted tabular-nums shrink-0">
                      {formatRelative(e.at, now)}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* ── Full history collapse ────────────────────────────────────── */}
      {items.length > 3 && (
        <div className="relative border-t border-edge/60">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-surface-sunken transition-colors"
          >
            <span className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest">
              Full log
            </span>
            <span className="text-[10px] font-bold text-ink-muted tabular-nums">
              {items.length}
            </span>
            <motion.span
              animate={{ rotate: historyOpen ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="ml-auto text-ink-muted"
              aria-hidden="true"
            >
              <ChevronDown size={13} />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {historyOpen && (
              <motion.div
                key="log"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="border-t border-edge/60"
              >
                <ul className="max-h-56 overflow-y-auto divide-y divide-edge/50">
                  {items.slice(3).map((e) => {
                    const meta = KIND_META[e.kind];
                    return (
                      <li key={e.id} className="flex items-center gap-2 px-4 py-1.5">
                        <span
                          className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${meta.bg} ${meta.text}`}
                          aria-hidden="true"
                        >
                          <meta.Icon size={10} strokeWidth={3} />
                        </span>
                        <p className="text-[11px] text-ink leading-tight truncate flex-1">
                          {e.message}
                        </p>
                        <span className="text-[10px] text-ink-muted tabular-nums shrink-0">
                          {formatRelative(e.at, now)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex justify-end px-2 py-1.5 border-t border-edge/60 bg-surface-sunken/40">
                  <button
                    type="button"
                    onClick={clearRewardHistory}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-destructive px-2 py-1 rounded-full"
                  >
                    <Trash2 size={11} aria-hidden="true" /> Clear log
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
