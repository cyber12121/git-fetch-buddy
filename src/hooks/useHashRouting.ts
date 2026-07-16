import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sync a tab-like state with `window.location.hash` so back/forward
 * navigation and shareable deep-links (e.g. `/#habits`) select the right
 * tab. Also exposes a `focusMain` helper that scrolls and focuses the
 * given <main> element after the next paint (so freshly-mounted modules
 * exist in the DOM before we try to focus them).
 */
export function useHashRouting<T extends string>(
  validTabs: readonly T[],
  initial: T
) {
  const isTab = useCallback(
    (v: string): v is T => (validTabs as readonly string[]).includes(v),
    [validTabs]
  );
  const readTab = useCallback((): T | null => {
    if (typeof window === "undefined") return null;
    const h = window.location.hash.replace(/^#\/?/, "");
    return isTab(h) ? h : null;
  }, [isTab]);

  const [activeTab, setActiveTabState] = useState<T>(initial);
  const mainRef = useRef<HTMLElement | null>(null);

  const focusMain = useCallback(() => {
    requestAnimationFrame(() => {
      const el = mainRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.focus({ preventScroll: true });
    });
  }, []);

  // First `apply()` on mount only syncs state from the URL — it must NOT
  // steal focus or scroll, or every page load jumps to the tabpanel.
  // Only user-driven navigation (popstate / hashchange) focuses main.
  useEffect(() => {
    const applyInitial = () => {
      const t = readTab();
      if (t) setActiveTabState(t);
    };
    const applyNav = () => {
      const t = readTab();
      if (t) {
        setActiveTabState(t);
        focusMain();
      }
    };
    applyInitial();
    window.addEventListener("popstate", applyNav);
    window.addEventListener("hashchange", applyNav);
    return () => {
      window.removeEventListener("popstate", applyNav);
      window.removeEventListener("hashchange", applyNav);
    };
  }, [focusMain, readTab]);

  const setActiveTab = useCallback(
    (tab: T) => {
      setActiveTabState(tab);
      if (typeof window !== "undefined") {
        const target = `#${tab}`;
        if (window.location.hash !== target) {
          window.history.pushState(null, "", target);
        }
      }
      focusMain();
    },
    [focusMain]
  );

  return { activeTab, setActiveTab, mainRef };
}
