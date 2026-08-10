// Theme system — swap the whole palette + typography by writing CSS vars
// onto :root. Themes are opt-in and persist in localStorage.

import { useEffect, useState } from "react";

export type ThemeId = "cozy-goblin" | "kinetic-dark" | "neon-dark";

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
  name: "Cozy Moss",
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





// Neon Dark — near-black canvas with electric cyan + magenta edge lighting.
// Cyberpunk terminal energy: inky surfaces, luminous hairlines, glowing brand.
const NEON: ThemeDef = {
  id: "neon-dark",
  name: "Neon Dark",
  description: "Inky black with electric cyan and magenta glow.",
  swatches: ["#05060a", "#00E5FF", "#FF2E9A", "#B4FF39"],
  fontSans: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  vars: {
    "--background": "#05060a",
    "--foreground": "#E6FBFF",
    "--card": "#0b0e16",
    "--card-foreground": "#E6FBFF",
    "--popover": "#0b0e16",
    "--popover-foreground": "#E6FBFF",
    "--primary": "#00E5FF",
    "--primary-foreground": "#03060a",
    "--secondary": "#131826",
    "--secondary-foreground": "#E6FBFF",
    "--muted": "#101521",
    "--muted-foreground": "#7C8DA6",
    "--accent": "#FF2E9A",
    "--accent-foreground": "#05060a",
    "--destructive": "#FF3B6B",
    "--destructive-foreground": "#05060a",
    "--border": "rgba(0,229,255,0.16)",
    "--input": "rgba(0,229,255,0.22)",
    "--ring": "#00E5FF",

    "--color-canvas": "#05060a",
    "--color-surface": "#0b0e16",
    "--color-surface-sunken": "#080a11",
    "--color-surface-raised": "#131826",
    "--color-surface-raised2": "#101521",
    "--color-surface-disabled": "#101521",
    "--color-ink": "#E6FBFF",
    "--color-ink-2": "#C7E9F5",
    "--color-ink-muted": "#7C8DA6",
    "--color-edge": "rgba(0,229,255,0.16)",
    "--color-edge-soft": "rgba(0,229,255,0.08)",
    "--color-edge-strong": "rgba(255,46,154,0.35)",
    "--color-brand": "#00E5FF",
    "--color-brand-hover": "#5CF2FF",
    "--color-brand-soft": "rgba(0,229,255,0.18)",

    "--theme-glow": "0 0 34px rgba(0,229,255,0.40)",
    "color-scheme": "dark",
  },
};

export const THEMES: ThemeDef[] = [COZY, KINETIC, NEON];
export const THEME_MAP: Record<ThemeId, ThemeDef> = {
  "cozy-goblin": COZY,
  "kinetic-dark": KINETIC,
  "neon-dark": NEON,
};

const STORAGE_KEY = "goblin_theme";
const DEFAULT: ThemeId = "cozy-goblin";
const VALID_IDS: ThemeId[] = ["cozy-goblin", "kinetic-dark", "neon-dark"];

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
  if (id === "kinetic-dark" || id === "neon-dark") root.classList.add("dark");
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



