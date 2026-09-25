import { useMemo } from "react";
import { fontService } from "../lib/fonts";

type TypographyRole =
  | "display-large"
  | "display-medium"
  | "body-large"
  | "body-medium"
  | "body-small"
  | "caption"
  | "code"
  | "accent";

type TypographySizes = {
  fontFamily: string;
  fontWeight: string | number;
  fontSize: string;
  lineHeight: string;
  letterSpacing?: string;
  textTransform?: "uppercase" | "lowercase" | "capitalize" | "none";
};

type TypographyScale = Record<TypographyRole, TypographySizes>;

interface TypographyConfig {
  scale: TypographyScale;
  cssVars: Record<string, string>;
}

// Google Fonts CDN URLs
const GOOGLE_FONTS = {
  bauhausBold: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&display=swap",
  openSans: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap",
  greatVibes: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap",
} as const;

export const useTypography = (): TypographyConfig => {
  const scale: TypographyScale = useMemo(() => ({
    "display-large": {
      fontFamily: "Bauhaus Bold, Space Mono, monospace",
      fontWeight: 700,
      fontSize: "clamp(1.5rem, 4vw, 3rem)",
      lineHeight: "1.1",
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
    },
    "display-medium": {
      fontFamily: "Bauhaus Bold, Space Mono, monospace",
      fontWeight: 700,
      fontSize: "clamp(1.25rem, 3vw, 2rem)",
      lineHeight: "1.2",
      letterSpacing: "-0.01em",
      textTransform: "uppercase",
    },
    "body-large": {
      fontFamily: "Open Sans, system-ui, sans-serif",
      fontWeight: 400,
      fontSize: "1rem",
      lineHeight: "1.5",
    },
    "body-medium": {
      fontFamily: "Open Sans, system-ui, sans-serif",
      fontWeight: 500,
      fontSize: "0.875rem",
      lineHeight: "1.4",
    },
    "body-small": {
      fontFamily: "Open Sans, system-ui, sans-serif",
      fontWeight: 400,
      fontSize: "0.75rem",
      lineHeight: "1.3",
    },
    "caption": {
      fontFamily: "Open Sans, system-ui, sans-serif",
      fontWeight: 300,
      fontSize: "0.625rem",
      lineHeight: "1.2",
      textTransform: "uppercase",
    },
    "code": {
      fontFamily: "Bauhaus Bold, Space Mono, monospace",
      fontWeight: 400,
      fontSize: "0.875rem",
      lineHeight: "1.3",
    },
    "accent": {
      fontFamily: "Great Vibes, cursive",
      fontWeight: 400,
      fontSize: "1.5rem",
      lineHeight: "1.2",
    },
  }), []);

  const cssVars: Record<string, string> = useMemo(() => {
    const vars: Record<string, string> = {};
    Object.entries(scale).forEach(([role, style]) => {
      Object.entries(style).forEach(([key, value]) => {
        if (key !== "fontFamily") {
          vars[`--typography-${role}-${key}`] = String(value);
        }
      });
    });
    vars["--font-bauhaus"] = "Bauhaus Bold, Space Mono, monospace";
    vars["--font-body"] = "Open Sans, system-ui, sans-serif";
    vars["--font-accent"] = "Great Vibes, cursive";
    return vars;
  }, [scale]);

  return { scale, cssVars };
};

export const typographyUtils = {
  getDisplayLarge: () => "text-[2rem] sm:text-[2.5rem] font-bauhaus font-bold tracking-[-0.02em] uppercase",
  getDisplayMedium: () => "text-[1.25rem] sm:text-[1.875rem] font-bauhaus font-bold tracking-[-0.01em] uppercase",
  getBodyLarge: () => "text-base font-sans text-ink",
  getBodyMedium: () => "text-sm font-sans font-medium text-ink",
  getBodySmall: () => "text-xs font-sans text-ink-muted",
  getCaption: () => "text-[10px] font-sans uppercase text-ink-muted tracking-[0.16em]",
  getCode: () => "font-mono text-sm text-ink",
  getAccent: () => "font-accent text-brand",
};