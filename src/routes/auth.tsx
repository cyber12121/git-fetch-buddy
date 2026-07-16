import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth, signInWithGoogle } from "@/lib/firebaseAuth";
import { enableGuestMode } from "@/lib/guestMode";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — Momentum" },
      { name: "description", content: "Sign in to Momentum with your Google account to sync tasks, habits and calendar across devices." },
      { property: "og:title", content: "Sign In — Momentum" },
      { property: "og:description", content: "Sign in to Momentum with your Google account to sync tasks, habits and calendar across devices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

function isSafeNext(v: string) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//");
}

function AuthPage() {
  const { next } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, forward immediately.
  useEffect(() => {
    if (auth.currentUser) {
      window.location.href = isSafeNext(next) ? next : "/";
    }
  }, [next]);

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      window.location.href = isSafeNext(next) ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm">
        <h1 className="text-xl font-bold mb-1">Sign in to Momentum</h1>
        <p className="text-sm text-ink-muted mb-4">
          Sign in with Google to sync your quests, habits and calendar across devices.
        </p>
        {error && <p className="text-sm text-danger mb-3">{error}</p>}
        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="w-full py-2 rounded-lg bg-brand text-primary-foreground font-bold text-sm disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          <span className="h-px flex-1 bg-edge" />
          or
          <span className="h-px flex-1 bg-edge" />
        </div>

        <button
          type="button"
          onClick={() => {
            enableGuestMode();
            window.location.href = isSafeNext(next) ? next : "/";
          }}
          disabled={busy}
          className="w-full py-2 rounded-lg border border-edge bg-surface text-ink font-bold text-sm hover:bg-surface-sunken transition disabled:opacity-60"
        >
          Continue as guest
        </button>
        <p className="mt-2 text-[11px] text-ink-muted text-center leading-snug">
          Guest data stays on this device — no cloud sync, no Google Calendar.
        </p>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-ink-muted underline">Back to app</Link>
        </div>

      </div>
    </main>
  );
}
