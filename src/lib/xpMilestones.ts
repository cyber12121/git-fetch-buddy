/**
 * XP milestone thresholds and their celebratory labels.
 * Kept at module scope so identity is stable across renders (allows
 * downstream memoization) and easy to tune in one place.
 */
export const XP_MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000] as const;

export const MILESTONE_LABELS: Record<number, string> = {
  50: "🌱 First 50 XP! Sprig is proud.",
  100: "🍄 100 XP — Level 2 unlocked!",
  250: "⚡ 250 XP — you're on a roll!",
  500: "🔥 500 XP — Sprig is beaming!",
  1000: "👑 1000 XP — legendary goblin!",
  2500: "🌟 2500 XP — myth-tier hustler.",
  5000: "🏆 5000 XP — Sprig bows to you.",
};

export const CONFETTI_COLORS = ["#F27D26", "#556B55", "#FFD4A3", "#FBBF24"] as const;
