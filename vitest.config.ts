import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Standalone Vitest config so tests don't pull in the TanStack Start /
 * Nitro Vite plugin chain (which expects a full route tree + SSR entry).
 * Keeping this separate from vite.config.ts lets `vitest` run in a
 * lightweight jsdom environment without touching the app runtime setup.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});
