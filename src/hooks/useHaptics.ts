import { useEffect, useState } from "react";

/**
 * Vibration patterns for common feedback types.
 * These patterns map directly to the numeric sequence accepted by the Vibration API.
 */
const VIBRATION_PATTERNS: Record<
  "success" | "error" | "selection" | "impact",
  number[]
> = {
  success: [0, 100, 50, 100], // double tap
  error: [0, 200, 100, 200], // double long tap
  selection: [0, 50], // light tap
  impact: [0, 30], // micro tap
};

/**
 * Hook that enables haptic feedback on supported devices.
 *
 * - `vibrate(durationMs)` – single short/long vibration.
 * - `patternVibrate(pattern)` – vibrate according to a custom numeric pattern.
 * - `hapticFeedback(type)` – preset feedback types mapped to vibration patterns.
 * - `supported` – boolean indicating whether the Vibration API is available.
 *
 * The hook automatically disables all haptic actions when the API is not present
 * (e.g., mobile Safari, desktop browsers without support), preventing errors.
 */
export default function useHaptics() {
  // Determine support once on mount
  const [supported, setSupported] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const nav = window?.navigator;
    const canVibrate = typeof nav?.vibrate === "function";
    setSupported(canVibrate);
    if (!canVibrate) {
      // Optional: inform the developer via console (does not affect production)
      console.warn(
        "[useHaptics] The Vibration API is not available in this environment."
      );
    }
  }, []);

  /** Vibrate for a specific duration (ms) */
  const vibrate = (durationMs: number) => {
    if (supported) {
      // The Vibration API may throw if called with invalid values, so we guard
      // @ts-ignore – navigator.vibrate accepts a number
      navigator.vibrate(durationMs);
    }
  };

  /** Vibrate according to a custom numeric pattern */
  const patternVibrate = (pattern: number[]) => {
    if (!supported) return;
    let delay = 0;
    for (const ms of pattern) {
      setTimeout(() => {
        // @ts-ignore – navigator.vibrate accepts a number
        navigator.vibrate(ms);
      }, delay);
      delay += ms;
    }
  };

  /**
   * Trigger a predefined haptic feedback based on a type string.
   *
   * Supported types:
   * - "success" – double tap pattern
   * - "error"   – double long tap pattern
   * - "selection" – light tap
   * - "impact" – micro tap
   */
  const hapticFeedback = (type: "success" | "error" | "selection" | "impact") => {
    const pattern = VIBRATION_PATTERNS[type];
    if (pattern) {
      patternVibrate(pattern);
    }
  };

  // Return everything needed for typical consumption.
  return { vibrate, patternVibrate, hapticFeedback, supported };
}