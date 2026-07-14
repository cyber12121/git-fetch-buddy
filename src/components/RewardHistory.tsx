import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Trash2, Sparkles } from "lucide-react";
import {
  subscribeRewardHistory,
  clearRewardHistory,
  type RewardEntry,
} from "../lib/rewardHistory";

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

const KIND_STYLE: Record<RewardEntry["kind"], string> = {
  combo: "text-amber-700 bg-amber-50 border-amber-200",
  milestone: "text-orange-700 bg-orange-50 border-orange-200",
  achievement: "text-emerald-700 bg-emerald-50 border-emerald-200",
  levelup: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200",
};

interface Props {
  /** Compact = collapsed by default. Desktop aside uses compact. */
  defaultOpen?: boolean;
}

export default function RewardHistory({ defaultOpen = false }: Props) {
  const [items, setItems] = useState<RewardEntry[]>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeRewardHistory(setItems), []);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [open]);

  return (
    <section
      aria-label="Reward history"
      className="rounded-2xl border border-edge bg-surface-sunken/80 shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
      >
        <Sparkles size={14} className="text-brand shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold text-ink tracking-wide">Reward log</span>
        <span className="text-[10px] font-semibold text-ink-muted tabular-nums ml-1">
          {items.length}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="ml-auto text-ink-muted"
          aria-hidden="true"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-edge/70"
          >
            {items.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-ink-muted">
                No rewards yet — finish a quest to start the chain 🌱
              </p>
            ) : (
              <>
                <ul className="max-h-64 overflow-y-auto divide-y divide-edge/60">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                      <span
                        className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs ${KIND_STYLE[e.kind]}`}
                        aria-hidden="true"
                      >
                        {e.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-ink leading-snug truncate">
                          {e.message}
                        </p>
                        <p className="text-[10px] text-ink-muted tabular-nums">
                          <time dateTime={new Date(e.at).toISOString()}>
                            {formatRelative(e.at, now)}
                          </time>
                          <span className="mx-1">·</span>
                          {new Date(e.at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end px-2 py-1.5 border-t border-edge/60 bg-surface/40">
                  <button
                    type="button"
                    onClick={clearRewardHistory}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-destructive px-2 py-1 rounded-full"
                  >
                    <Trash2 size={11} aria-hidden="true" /> Clear
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
