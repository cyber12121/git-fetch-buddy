import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const dest = isSafeNext(search.next) ? search.next : "/";
      throw redirect({ href: dest });
    }
  },
  component: AuthPage,
});

function isSafeNext(v: string) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//");
}

function AuthPage() {
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If session appears while on the page (e.g. after OAuth), forward.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        window.location.href = isSafeNext(next) ? next : "/";
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin + (isSafeNext(next) ? next : "/") },
            });
      if (error) throw error;
      // signInWithPassword sets the session synchronously; forward now.
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.href = isSafeNext(next) ? next : "/";
      else setError("Check your email to confirm your account, then sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth" + (isSafeNext(next) ? `?next=${encodeURIComponent(next)}` : ""),
      });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed");
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.href = isSafeNext(next) ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Connect an integration</h1>
        <p className="text-sm text-ink-muted mb-4">
          Sign in with a Lovable Cloud account to authorize external tools (like ChatGPT or Claude) to talk to your Goblin Flow workspace. This is separate from your regular app login.
        </p>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-edge bg-surface-sunken text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-edge bg-surface-sunken text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-brand text-primary-foreground font-bold text-sm disabled:opacity-60"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="mt-3 w-full py-2 rounded-lg border border-edge text-sm font-semibold disabled:opacity-60"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs text-ink-muted underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-ink-muted underline">Back to app</Link>
        </div>
      </div>
    </main>
  );
}
