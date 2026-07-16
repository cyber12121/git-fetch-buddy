import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";

// Direct Supabase issuer (never the .lovable.cloud proxy). Vite inlines
// VITE_SUPABASE_PROJECT_ID as a literal; the sentinel keeps discovery well-formed
// during the manifest-extract eval where env may be absent.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "momentum-mcp",
  title: "Momentum",
  version: "0.1.0",
  instructions:
    "Cozy productivity tools for Momentum. Use `whoami` to verify the connection. More tools (tasks, habits, calendar) coming soon.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool],
});
