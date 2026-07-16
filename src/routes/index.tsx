import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import App from "../App";
import { ToastProvider } from "../components/Toast";
import { auth } from "../lib/firebaseApp";
import { isGuestMode } from "../lib/guestMode";

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

function Index() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setGuest(isGuestMode());
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

  if (!user && !guest) {
    return <Navigate to="/auth" search={{ next: "/" }} />;
  }

  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

