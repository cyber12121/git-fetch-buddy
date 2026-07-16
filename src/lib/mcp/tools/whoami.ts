import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the authenticated user's identity (Lovable Cloud account) as seen by this MCP server.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const userId = ctx.getUserId();
    const email = ctx.getUserEmail() ?? "(no email on token)";
    return {
      content: [{ type: "text", text: `Signed in as ${email} (id: ${userId})` }],
      structuredContent: { userId, email },
    };
  },
});
