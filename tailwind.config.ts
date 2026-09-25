import { fontService } from './src/lib/fonts';

/**
 * Tailwind CSS configuration for biophilic design system
 *
 * Palette: Forest Green, Mossy Yellow, Terre Nuance, Coral
 * Typography: Bauhaus Bold display, Open Sans body
 */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {
      colors: {
        forestGreen: '#2E8B57',
        mossyYellow: '#9ACD32',
        terreNuance: '#DEB887',
        coral: '#F27D26',
        // Add secret color for hidden elements
        secretLavender: '#E6E6FA'
      },
      fontFamily: {
        'bauhaus-bold': 'Bauhaus Bold, Space Mono, monospace',
        'body': 'Open Sans, system-ui, sans-serif',
        'accent': 'Great Vibes, cursive'
      },
    },
    spacing: {...tailwindDefault.spacing, '/16': '1.5rem', '48/16': '3rem'},
  },

  plugins: [
    require('tailwindcss-nesting'),
  ],

  // Add typography variables from fontService
  variants: {
    extend: {
      textColor: {
        'forest-green': 'forestGreen',
        'mossy-yellow': 'mossyYellow',
        'terre-nuance': 'terreNuance',
        'coral-accent': 'coral',
      },
    },
  },
};

// Preload fonts on module load
if (typeof window !== 'undefined') {
  fontService.loadFonts();
}