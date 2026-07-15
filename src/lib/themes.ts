// Theme system — swap the whole palette + typography by writing CSS vars
// onto :root. Themes are opt-in and persist in localStorage.

import { useEffect, useState } from "react";

export type ThemeId = "cozy-goblin" | "kinetic-dark";

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

export const THEMES: ThemeDef[] = [COZY, KINETIC];
export const THEME_MAP: Record<ThemeId, ThemeDef> = {
  "cozy-goblin": COZY,
  "kinetic-dark": KINETIC,
};

const STORAGE_KEY = "goblin_theme";
const DEFAULT: ThemeId = "cozy-goblin";

export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (v === "cozy-goblin" || v === "kinetic-dark")) return v;
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
  if (id === "kinetic-dark") root.classList.add("dark");
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

