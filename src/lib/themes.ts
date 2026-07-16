// Theme system — swap the whole palette + typography by writing CSS vars
// onto :root. Themes are opt-in and persist in localStorage.

import { useEffect, useState } from "react";

export type ThemeId = "cozy-goblin" | "kinetic-dark" | "focus-paper" | "dopamine-arcade" | "sky-peach" | "quiet-mono";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  swatches: string[]; // preview swatches for the picker
  vars: Record<string, string>;
  fontSans?: string; // value for --font-sans / body font
  fontDisplay?: string; // value for --font-fredoka (display headings token)
  fontMono?: string;
}

// Baseline cozy goblin — matches the values already in styles.css.
const COZY: ThemeDef = {
  id: "cozy-goblin",
  name: "Cozy Goblin",
  description: "Warm mossy greens with an orange brand pop.",
  swatches: ["#E6F0E6", "#F27D26", "#556B55", "#FFD4A3"],
  fontSans: "'Fredoka', 'Nunito', sans-serif",
  fontDisplay: "'Fredoka', 'Nunito', sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  vars: {
    "--background": "#E6F0E6",
    "--foreground": "#1A261A",
    "--card": "#F9FBF9",
    "--card-foreground": "#1A261A",
    "--popover": "#F9FBF9",
    "--popover-foreground": "#1A261A",
    "--primary": "#F27D26",
    "--primary-foreground": "#FFFFFF",
    "--secondary": "#DCE8DC",
    "--secondary-foreground": "#1A261A",
    "--muted": "#DCE8DC",
    "--muted-foreground": "#465C46",
    "--accent": "#FFD4A3",
    "--accent-foreground": "#7A3B10",
    "--destructive": "#C0392B",
    "--destructive-foreground": "#FFFFFF",
    "--border": "#CDE0CD",
    "--input": "#CDE0CD",
    "--ring": "#F27D26",

    "--color-canvas": "#E6F0E6",
    "--color-surface": "#E6F0E6",
    "--color-surface-sunken": "#F9FBF9",
    "--color-surface-raised": "#F5F5F4",
    "--color-surface-raised2": "#E7E5E4",
    "--color-surface-disabled": "#D6D3D1",
    "--color-ink": "#1A261A",
    "--color-ink-2": "#2D3A2D",
    "--color-ink-muted": "#465C46",
    "--color-edge": "#CDE0CD",
    "--color-edge-soft": "#E6EEE6",
    "--color-edge-strong": "#D6D3D1",
    "--color-brand": "#F27D26",
    "--color-brand-hover": "#D96A1E",
    "--color-brand-soft": "#FFD4A3",

    "--theme-glow": "0 0 0 rgba(0,0,0,0)",
    "color-scheme": "light",
  },
};

// Kinetic Dark — deep navy-black canvas with vibrant dopamine accents.
const KINETIC: ThemeDef = {
  id: "kinetic-dark",
  name: "Kinetic Dark",
  description: "Dark canvas with vibrant dopamine-reward accents.",
  swatches: ["#0b0c14", "#8b5cf6", "#06b6d4", "#f59e0b"],
  fontSans: "'DM Sans', 'Inter', system-ui, sans-serif",
  fontDisplay: "'Outfit', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  vars: {
    "--background": "#0b0c14",
    "--foreground": "#f0f0fa",
    "--card": "#13141f",
    "--card-foreground": "#f0f0fa",
    "--popover": "#13141f",
    "--popover-foreground": "#f0f0fa",
    "--primary": "#8b5cf6",
    "--primary-foreground": "#0b0c14",
    "--secondary": "#1e1f30",
    "--secondary-foreground": "#f0f0fa",
    "--muted": "#1a1b2a",
    "--muted-foreground": "#7b7b9a",
    "--accent": "#06b6d4",
    "--accent-foreground": "#0b0c14",
    "--destructive": "#f43f5e",
    "--destructive-foreground": "#0b0c14",
    "--border": "rgba(255,255,255,0.08)",
    "--input": "rgba(255,255,255,0.12)",
    "--ring": "#8b5cf6",

    "--color-canvas": "#0b0c14",
    "--color-surface": "#13141f",
    "--color-surface-sunken": "#0d0e1a",
    "--color-surface-raised": "#1e1f30",
    "--color-surface-raised2": "#1a1b2a",
    "--color-surface-disabled": "#1a1b2a",
    "--color-ink": "#f0f0fa",
    "--color-ink-2": "#e4e4f0",
    "--color-ink-muted": "#7b7b9a",
    "--color-edge": "rgba(255,255,255,0.08)",
    "--color-edge-soft": "rgba(255,255,255,0.05)",
    "--color-edge-strong": "rgba(255,255,255,0.16)",
    "--color-brand": "#8b5cf6",
    "--color-brand-hover": "#a78bfa",
    "--color-brand-soft": "rgba(139,92,246,0.20)",

    "--theme-glow": "0 0 32px rgba(139,92,246,0.35)",
    "color-scheme": "dark",
  },
};

// Focus Paper — minimalist ADHD focus theme. Near-monochrome paper canvas,
// deep ink text for maximum contrast, one calm blue accent for focus cues,
// and a neutral system font stack to reduce visual noise.
const FOCUS: ThemeDef = {
  id: "focus-paper",
  name: "Focus Paper",
  description: "Minimal, low-stimulation, one calm accent.",
  swatches: ["#F7F7F5", "#111111", "#2563EB", "#E5E5E2"],
  fontSans: "'Inter', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Inter', system-ui, -apple-system, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  vars: {
    "--background": "#F7F7F5",
    "--foreground": "#111111",
    "--card": "#FFFFFF",
    "--card-foreground": "#111111",
    "--popover": "#FFFFFF",
    "--popover-foreground": "#111111",
    "--primary": "#2563EB",
    "--primary-foreground": "#FFFFFF",
    "--secondary": "#EFEFEC",
    "--secondary-foreground": "#111111",
    "--muted": "#EFEFEC",
    "--muted-foreground": "#5A5A57",
    "--accent": "#E8EEFB",
    "--accent-foreground": "#1E40AF",
    "--destructive": "#B91C1C",
    "--destructive-foreground": "#FFFFFF",
    "--border": "#E5E5E2",
    "--input": "#E5E5E2",
    "--ring": "#2563EB",

    "--color-canvas": "#F7F7F5",
    "--color-surface": "#FFFFFF",
    "--color-surface-sunken": "#F0F0ED",
    "--color-surface-raised": "#FFFFFF",
    "--color-surface-raised2": "#EFEFEC",
    "--color-surface-disabled": "#E5E5E2",
    "--color-ink": "#111111",
    "--color-ink-2": "#1F1F1F",
    "--color-ink-muted": "#5A5A57",
    "--color-edge": "#E5E5E2",
    "--color-edge-soft": "#EFEFEC",
    "--color-edge-strong": "#CFCFCB",
    "--color-brand": "#2563EB",
    "--color-brand-hover": "#1D4ED8",
    "--color-brand-soft": "#E8EEFB",

    "--theme-glow": "0 0 0 rgba(0,0,0,0)",
    "color-scheme": "light",
  },
};

// Dopamine Arcade — high-contrast, saturated, playful. Built for ADHD brains
// that want the reward loop to *feel* electric: black-violet canvas, hot
// magenta primary, electric cyan accent, sunshine highlight. Big glows.
const ARCADE: ThemeDef = {
  id: "dopamine-arcade",
  name: "Dopamine Arcade",
  description: "High-contrast neon — every win feels like a jackpot.",
  swatches: ["#0a0514", "#ff2d75", "#22d3ee", "#fde047"],
  fontSans: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  vars: {
    "--background": "#0a0514",
    "--foreground": "#fef6ff",
    "--card": "#150a24",
    "--card-foreground": "#fef6ff",
    "--popover": "#150a24",
    "--popover-foreground": "#fef6ff",
    "--primary": "#ff2d75",
    "--primary-foreground": "#0a0514",
    "--secondary": "#1a0f2e",
    "--secondary-foreground": "#fef6ff",
    "--muted": "#1a0f2e",
    "--muted-foreground": "#b8a5d4",
    "--accent": "#22d3ee",
    "--accent-foreground": "#0a0514",
    "--destructive": "#f43f5e",
    "--destructive-foreground": "#0a0514",
    "--border": "rgba(255,45,117,0.20)",
    "--input": "rgba(255,255,255,0.10)",
    "--ring": "#ff2d75",

    "--color-canvas": "#0a0514",
    "--color-surface": "#150a24",
    "--color-surface-sunken": "#0f0720",
    "--color-surface-raised": "#1f1236",
    "--color-surface-raised2": "#261645",
    "--color-surface-disabled": "#1a0f2e",
    "--color-ink": "#fef6ff",
    "--color-ink-2": "#f0e0ff",
    "--color-ink-muted": "#b8a5d4",
    "--color-edge": "rgba(255,45,117,0.20)",
    "--color-edge-soft": "rgba(255,255,255,0.06)",
    "--color-edge-strong": "rgba(34,211,238,0.35)",
    "--color-brand": "#ff2d75",
    "--color-brand-hover": "#ff5a92",
    "--color-brand-soft": "rgba(255,45,117,0.18)",

    "--theme-glow": "0 0 40px rgba(255,45,117,0.45)",
    "color-scheme": "dark",
  },
};

// Sky & Peach — soft sky-blue canvas with a warm peach-orange accent.
// Modern Tech pairing: Space Grotesk display, DM Sans body. Airy, roomy,
// gentle contrast — designed to feel like an open window on a clear morning.
const SKY_PEACH: ThemeDef = {
  id: "sky-peach",
  name: "Sky & Peach",
  description: "Airy sky blue with a warm peach-orange accent.",
  swatches: ["#f0f9ff", "#e0f2fe", "#FB923C", "#0c4a6e"],
  fontSans: "'DM Sans', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  vars: {
    "--background": "#f0f9ff",
    "--foreground": "#0c4a6e",
    "--card": "#ffffff",
    "--card-foreground": "#0c4a6e",
    "--popover": "#ffffff",
    "--popover-foreground": "#0c4a6e",
    "--primary": "#FB923C",
    "--primary-foreground": "#ffffff",
    "--secondary": "#e0f2fe",
    "--secondary-foreground": "#0c4a6e",
    "--muted": "#e0f2fe",
    "--muted-foreground": "#0369a1",
    "--accent": "#F97316",
    "--accent-foreground": "#ffffff",
    "--destructive": "#dc2626",
    "--destructive-foreground": "#ffffff",
    "--border": "#bae6fd",
    "--input": "#bae6fd",
    "--ring": "#FB923C",

    "--color-canvas": "#f0f9ff",
    "--color-surface": "#ffffff",
    "--color-surface-sunken": "#e0f2fe",
    "--color-surface-raised": "#ffffff",
    "--color-surface-raised2": "#f0f9ff",
    "--color-surface-disabled": "#e0f2fe",
    "--color-ink": "#0c4a6e",
    "--color-ink-2": "#075985",
    "--color-ink-muted": "#0369a1",
    "--color-edge": "#bae6fd",
    "--color-edge-soft": "#e0f2fe",
    "--color-edge-strong": "#7dd3fc",
    "--color-brand": "#FB923C",
    "--color-brand-hover": "#F97316",
    "--color-brand-soft": "#ffedd5",

    "--theme-glow": "0 12px 40px -12px rgba(251,146,60,0.35)",
    "color-scheme": "light",
  },
};

export const THEMES: ThemeDef[] = [COZY, SKY_PEACH, KINETIC, FOCUS, ARCADE];
export const THEME_MAP: Record<ThemeId, ThemeDef> = {
  "cozy-goblin": COZY,
  "kinetic-dark": KINETIC,
  "focus-paper": FOCUS,
  "dopamine-arcade": ARCADE,
  "sky-peach": SKY_PEACH,
};

const STORAGE_KEY = "goblin_theme";
const DEFAULT: ThemeId = "cozy-goblin";
const VALID_IDS: ThemeId[] = ["cozy-goblin", "kinetic-dark", "focus-paper", "dopamine-arcade", "sky-peach"];

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (VALID_IDS as string[]).includes(v)) return v as ThemeId;
  } catch { /* ignore */ }
  return DEFAULT;
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = THEME_MAP[id] ?? THEME_MAP[DEFAULT];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  if (theme.fontSans) {
    root.style.setProperty("--font-sans", theme.fontSans);
    root.style.setProperty("--font-nunito", theme.fontSans);
  }
  if (theme.fontDisplay) {
    root.style.setProperty("--font-fredoka", theme.fontDisplay);
  }
  if (theme.fontMono) {
    root.style.setProperty("--font-mono", theme.fontMono);
  }
  root.dataset.theme = id;
  // Toggle Tailwind's `dark` variant so any `dark:` utilities behave correctly.
  if (id === "kinetic-dark" || id === "dopamine-arcade") root.classList.add("dark");
  else root.classList.remove("dark");
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("goblin:theme-change", { detail: id }));
}

/** Subscribe to theme changes. Returns unsubscribe. */
export function subscribeTheme(cb: (id: ThemeId) => void): () => void {
  const handler = (e: Event) => {
    const id = (e as CustomEvent<ThemeId>).detail;
    if (id) cb(id);
  };
  window.addEventListener("goblin:theme-change", handler);
  return () => window.removeEventListener("goblin:theme-change", handler);
}

export function useTheme(): ThemeId {
  // Start with the default on both server and initial client render to avoid
  // hydration mismatches, then read the persisted value in an effect.
  const [id, setId] = useState<ThemeId>(DEFAULT);
  useEffect(() => {
    setId(readStoredTheme());
    return subscribeTheme(setId);
  }, []);
  return id;
}



