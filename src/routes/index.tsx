import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../lib/firebaseApp";
import { isGuestMode } from "../lib/guestMode";

/**
 * Root entry. The app used to live entirely at `/` with hash-based tabs; we
 * now redirect to `/today` (or `/auth`) so every workspace has a real URL,
 * back button, and shareable link. Legacy `/#today` links are upgraded to
 * `/today` client-side before the redirect fires.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:url", content: "https://git-friend-come-here.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://git-friend-come-here.lovable.app/" },
    ],
  }),
  component: Index,
});

const KNOWN_TABS = new Set([
  "daily",
  "compiler",
  "todo",
  "taskmaster",
  "calendar",
  "weekly",
  "habits",
]);

function Index() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);
  // Upgrade any legacy `/#today` deep link into `/today` before we route.
  const [legacyTab, setLegacyTab] = useState<string | null>(null);

  useEffect(() => {
    setGuest(isGuestMode());
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (KNOWN_TABS.has(hash)) {
        setLegacyTab(hash);
        // Strip the hash so the redirect target doesn't inherit it.
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch { /* ignore */ }
      }
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  if (!ready) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-canvas text-ink-muted">
        Loading…
      </main>
    );
  }

  const target = legacyTab ?? "daily";

  if (!user && !guest) {
    return <Navigate to="/auth" search={{ next: `/${target}` }} />;
  }

  return <Navigate to="/$tab" params={{ tab: target }} />;
}
