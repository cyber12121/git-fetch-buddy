import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../lib/firebaseApp";
import { isGuestMode } from "../lib/guestMode";
import { ToastProvider } from "../components/Toast";

/**
 * Pathless auth-gate layout for the entire signed-in surface (today, todo,
 * calendar, etc.). Extracted from the old single-page shell so every tab is
 * a real, shareable, back-button-friendly URL.
 *
 * Auth check has to run on the client — Firebase auth state lives in
 * localStorage — so this route is `ssr: false`. The loader gate pattern from
 * TanStack docs would need a Suspense-friendly session source; the plain
 * client check keeps the flash to a single "Loading…" frame.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
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
    // Preserve the intended destination so /auth can bounce back after sign-in.
    const next =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/today";
    return <Navigate to="/auth" search={{ next }} />;
  }

  return (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  );
}
