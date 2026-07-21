import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { recordReward } from "../lib/rewardHistory";
import { CONFETTI_COLORS, MILESTONE_LABELS, XP_MILESTONES } from "../lib/xpMilestones";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface Options {
  pushToast: (t: { icon?: string; tone?: "success" | "warn" | "info"; message: string }) => void;
  onLevelUp?: (msg: string, mood: GubbyMood) => void;
}

/**
 * Centralizes the Sprig XP/combo/level-up feedback loop:
 *   - persists XP to localStorage (safe against quota / disabled storage)
 *   - fires milestone toasts + confetti when crossing thresholds
 *   - awards escalating combo bonuses for chained completions
 *   - fires a level-up celebration with a sentinel so the first observation
 *     of `xp` (initial 0 / hydrated / cloud-merged) does NOT bogus-fire.
 */
export function useXpSystem({ pushToast, onLevelUp }: Options) {
  const [xp, setXp] = useState<number>(0);
  // Sentinel: don't fire the level-up celebration when XP jumps from 0
  // (initial mount) to the hydrated/cloud-merged value. Only real, live
  // increments after hydration should celebrate.
  const hydratedRef = useRef(false);

  // Hydrate from localStorage after mount — avoids SSR hydration mismatch.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("goblin_xp") || "0");
      if (Number.isFinite(saved) && saved > 0) setXp(saved);
    } catch { /* ignore */ }
    // hydratedRef flips true only when a real live increment happens
    // (addXp call). This prevents the level-up effect from firing on the
    // hydration/cloud-merge XP jump after a page reload.
  }, []);


  const addXp = useCallback((amount: number) => {
    setXp((prev) => {
      const next = Math.max(0, prev + amount);
      try { localStorage.setItem("goblin_xp", String(next)); } catch { /* ignore */ }
      if (amount > 0) {
        for (const m of XP_MILESTONES) {
          if (prev < m && next >= m) {
            const label = MILESTONE_LABELS[m];
            pushToast({ icon: "🎉", tone: "success", message: label });
            recordReward("milestone", "🎉", label);
            confetti({
              particleCount: 60,
              spread: 55,
              origin: { y: 0.7 },
              colors: ["#F27D26", "#FBBF24", "#556B55"],
            });
            break;
          }
        }
      }
      return next;
    });
  }, [pushToast]);

  // Combo: chain completions within 45s for escalating +5/+10/+15… bonuses.
  const comboRef = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const registerCombo = useCallback(() => {
    const now = Date.now();
    const within = now - comboRef.current.lastAt < 45_000;
    const nextCount = within ? comboRef.current.count + 1 : 1;
    comboRef.current = { count: nextCount, lastAt: now };
    if (nextCount >= 2) {
      const bonus = Math.min(nextCount - 1, 5) * 5;
      addXp(bonus);
      const msg = `${nextCount}× combo! +${bonus} bonus XP`;
      pushToast({ icon: "⚡", tone: "success", message: msg });
      recordReward("combo", "⚡", msg);
    }
    return nextCount;
  }, [addXp, pushToast]);

  // Level-up celebration. Two sentinels prevent bogus fires:
  //  - prevLevelRef=null on very first observation
  //  - hydratedRef=false during the hydration/cloud-merge XP jump
  const prevLevelRef = useRef<number | null>(null);
  useEffect(() => {
    const lvl = Math.floor(xp / 100) + 1;
    if (
      hydratedRef.current &&
      prevLevelRef.current !== null &&
      lvl > prevLevelRef.current
    ) {
      const msg = `Sprig grew to Level ${lvl}! 🎉 You're stronger with every quest.`;
      onLevelUp?.(msg, "excited");
      recordReward("levelup", "🌿", `Level ${lvl} reached!`);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
        colors: [...CONFETTI_COLORS],
      });
    }
    prevLevelRef.current = lvl;
  }, [xp, onLevelUp]);

  return { xp, setXp, addXp, registerCombo };
}
