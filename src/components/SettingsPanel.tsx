import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Settings, X, Check, Palette, Trophy } from "lucide-react";
import { THEMES, applyTheme, readStoredTheme, type ThemeId } from "../lib/themes";
import RewardHistory from "./RewardHistory";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Settings sheet. Right-side drawer housing the theme picker and the reward
 * dashboard. Rendered via a portal so no transformed ancestor can clip the
 * fixed overlay. Behavior: Escape to close, outside-click to close, focus
 * trap while open, body scroll lock, and focus restore on close.
 */
export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("cozy-goblin");
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setTheme(readStoredTheme());
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
  };

  // Escape + Tab-trap while open. Restore focus to trigger on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Body scroll lock (preserve scroll offset).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the panel after it mounts.
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const visible = Array.from(nodes).filter(
        (el) => !el.hasAttribute("data-focus-skip") && el.offsetParent !== null,
      );
      if (visible.length === 0) {
        e.preventDefault();
        return;
      }
      const first = visible[0];
      const last = visible[visible.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      // Restore focus to whatever opened the drawer.
      (previouslyFocused ?? triggerRef.current)?.focus?.();
    };
  }, [open, close]);


  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden="true"
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            key="panel"
            ref={(el) => { panelRef.current = el as HTMLElement | null; }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-[9999] w-full sm:w-[420px] bg-card border-l border-edge shadow-2xl flex flex-col outline-none"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >

            <header className="flex items-center justify-between px-5 py-4 border-b border-edge/70 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 text-primary">
                  <Settings size={16} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-ink font-fredoka">Settings</h2>
                  <p className="text-[10px] text-ink-muted">Make it yours — everything saves automatically.</p>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close settings"
                className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section aria-labelledby="settings-theme">
                <div className="flex items-center gap-2 mb-3">
                  <Palette size={14} className="text-brand" aria-hidden="true" />
                  <h3 id="settings-theme" className="text-xs font-extrabold text-ink uppercase tracking-widest">
                    Theme
                  </h3>
                </div>
                <ul className="grid grid-cols-1 gap-2">
                  {THEMES.map((t) => {
                    const active = t.id === theme;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => pick(t.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left border transition-all ${
                            active
                              ? "bg-primary/8 border-primary/50 shadow-[0_0_0_3px_var(--color-brand-soft)]"
                              : "bg-surface-sunken border-edge hover:border-edge-strong"
                          }`}
                        >
                          <span
                            className="flex -space-x-1.5 shrink-0 p-1 rounded-full bg-canvas/40"
                            aria-hidden="true"
                          >
                            {t.swatches.map((c, i) => (
                              <span
                                key={i}
                                className="w-5 h-5 rounded-full border border-edge shadow-sm"
                                style={{ background: c }}
                              />
                            ))}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-ink truncate">{t.name}</span>
                            <span className="block text-[11px] text-ink-muted truncate">{t.description}</span>
                          </span>
                          {active && (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shrink-0">
                              <Check size={13} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section aria-labelledby="settings-rewards" className="pt-2 border-t border-edge/50">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} className="text-brand" aria-hidden="true" />
                  <h3 id="settings-rewards" className="text-xs font-extrabold text-ink uppercase tracking-widest">
                    Rewards
                  </h3>
                </div>
                <RewardHistory defaultOpen />
              </section>

              <section aria-labelledby="settings-about" className="pt-2 border-t border-edge/50">
                <h3 id="settings-about" className="text-[10px] font-extrabold text-ink-muted uppercase tracking-widest mb-2">
                  About
                </h3>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Momentum is a cozy focus OS built for ADHD brains. Your data syncs to the
                  cloud when signed in — nothing tracks you.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        className="flex items-center gap-1.5 bg-surface-sunken/80 border border-edge rounded-full px-2.5 py-1 shadow-sm text-ink-muted hover:text-ink transition-colors min-h-8"
      >
        <Settings size={14} aria-hidden="true" />
        <span className="hidden sm:inline text-[11px] font-bold">Settings</span>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
