/**
 * Google Fonts service for loading custom fonts
 *
 * Fonts loaded via CDN for biophilic design system:
 * - Space Mono (Bauhaus alternative): For display headers and code
 * - Open Sans: For body content
 * - Great Vibes: For celebratory accents
 */

export const fontService = {
  // Font families as they'll appear in CSS
  fontFamilies: {
    bauhaus: "Bauhaus Bold, Space Mono, monospace",
    body: "Open Sans, system-ui, sans-serif",
    accent: "Great Vibes, cursive",
  },

  // Google Fonts URLs to preload
  urls: [
    "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
    "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700;800&display=swap",
    "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap",
  ] as const,

  // Font loading utility
  loadFonts: (): void => {
    if (typeof document === "undefined") return;
    fontService.urls.forEach((url) => {
      const link = document.createElement("link");
      link.href = url;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    });
  },
};

// Preload fonts on module load in browser
if (typeof window !== "undefined") {
  fontService.loadFonts();
}