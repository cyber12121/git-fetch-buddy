import { useCallback, useEffect, useState } from "react";

export type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

/**
 * Owns Sprig companion presentational state (message, mood, hidden).
 * Hidden preference persists to localStorage; hydrated after mount to
 * avoid SSR hydration mismatch.
 */
export function useGubbyState() {
  const [gubbyMessage, setGubbyMessage] = useState<string>(
    "Welcome to Momentum! Sprig is here to help you defeat task paralysis. Where should we start?"
  );
  const [gubbyMood, setGubbyMood] = useState<GubbyMood>("cozy");
  const [gubbyHidden, setGubbyHiddenState] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("goblin_gubby_hidden") === "1") setGubbyHiddenState(true);
    } catch { /* ignore */ }
  }, []);

  const updateGubbyHidden = useCallback((hidden: boolean) => {
    setGubbyHiddenState(hidden);
    try {
      localStorage.setItem("goblin_gubby_hidden", hidden ? "1" : "0");
    } catch { /* ignore */ }
  }, []);

  const triggerGubbySpeak = useCallback((msg: string, mood: GubbyMood) => {
    setGubbyMessage(msg);
    setGubbyMood(mood);
  }, []);

  return {
    gubbyMessage,
    gubbyMood,
    gubbyHidden,
    setGubbyMood,
    setGubbyMessage,
    updateGubbyHidden,
    triggerGubbySpeak,
  };
}
