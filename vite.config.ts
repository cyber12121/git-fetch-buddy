import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      // @lovable.dev/mcp-js has a Windows path separator bug in assertContains (compares '/' with '\').
      // Only enable on non-Windows platforms (e.g. Lovable Cloud / Linux CI).
      ...(process.platform !== "win32" ? [mcpPlugin()] : []),
    ],
  },
});