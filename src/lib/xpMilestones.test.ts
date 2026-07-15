import { describe, expect, it } from "vitest";
import { CONFETTI_COLORS, MILESTONE_LABELS, XP_MILESTONES } from "./xpMilestones";

describe("XP milestone tables", () => {
  it("declares milestones in strictly ascending order", () => {
    for (let i = 1; i < XP_MILESTONES.length; i++) {
      expect(XP_MILESTONES[i]).toBeGreaterThan(XP_MILESTONES[i - 1]);
    }
  });

  it("has a label for every milestone", () => {
    for (const m of XP_MILESTONES) {
      expect(MILESTONE_LABELS[m]).toBeTruthy();
      expect(typeof MILESTONE_LABELS[m]).toBe("string");
    }
  });

  it("exposes at least one confetti color", () => {
    expect(CONFETTI_COLORS.length).toBeGreaterThan(0);
    for (const c of CONFETTI_COLORS) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
    }
  });

  it("crossing a milestone is detected by the standard prev/next check", () => {
    // Mirrors the exact condition in useXpSystem.addXp.
    const cross = (prev: number, next: number) =>
      XP_MILESTONES.filter((m) => prev < m && next >= m);

    expect(cross(0, 50)).toEqual([50]);
    expect(cross(49, 100)).toEqual([50, 100]);
    expect(cross(100, 100)).toEqual([]);
    expect(cross(499, 500)).toEqual([500]);
  });
});
