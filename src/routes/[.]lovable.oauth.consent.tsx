import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// TanStack file router: [.] escapes the literal dot in the URL segment.
// The URL is /.lovable/oauth/consent
export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const anyData = data as Record<string, unknown> | null;
    const immediate = (anyData?.redirect_url as string | undefined) ?? (anyData?.redirect_to as string | undefined);
    if (immediate && !anyData?.client) throw redirect({ href: immediate });
    return anyData as {
      client?: { name?: string; redirect_uris?: string[] };
      scope?: string;
    } | null;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-bold mb-2">Could not load this authorization request</h1>
        <p className="text-sm text-ink-muted">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const client = supabase.auth.oauth;
    const { data, error } = approve
      ? await client.approveAuthorization(authorization_id)
      : await client.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const anyData = data as Record<string, unknown> | null;
    const target = (anyData?.redirect_url as string | undefined) ?? (anyData?.redirect_to as string | undefined);
    if (!target) {
      setBusy(false);
      setError("No redirect URL returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const redirectUri = details?.client?.redirect_uris?.[0];

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-2">Connect {clientName} to Goblin Flow</h1>
        <p className="text-sm text-ink-muted mb-4">
          This lets {clientName} use Goblin Flow's tools while you are signed in. It does not bypass any app permissions.
        </p>
        {redirectUri && (
          <p className="text-xs text-ink-muted mb-4 break-all">
            Redirects to: <span className="font-mono">{redirectUri}</span>
          </p>
        )}
        {error && <p className="text-sm text-danger mb-3" role="alert">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 py-2 rounded-lg bg-brand text-primary-foreground font-bold text-sm disabled:opacity-60"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 py-2 rounded-lg border border-edge text-sm font-semibold disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
