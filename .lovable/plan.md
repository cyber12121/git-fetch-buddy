# UI Modernization Plan — Goblin Flow

Frontend-only pass to make the app feel modern, work well on every screen, and meet WCAG AA. No business logic or backend changes.

## 1. Design token cleanup (foundation for everything else)

- Remove hardcoded hex values (`#DCE8DC`, `#F27D26`, `#FF9D4E`, `#E6EEE6`, …) from `AppNav.tsx` and modules; use existing tokens (`--color-brand`, `--color-surface`, `--color-edge`, `--color-ink`, …).
- Map shadcn tokens (`--background`, `--foreground`, `--primary`, `--border`, `--muted-foreground`, …) onto the goblin palette in `src/styles.css` so shadcn Buttons/Inputs/Dialogs match the cozy aesthetic instead of default slate.
- Fix Tailwind v4 defaults already used in the code: bare `border` (now `currentColor`) → `border border-edge`; bare `shadow`/`rounded` remapped explicitly.
- Verify `text-ink-muted` on `bg-surface` passes AA; darken the token slightly if not.

## 2. Responsive navigation

Current top nav overflows on 591px width and hides the XP/status row on mobile.

- Convert the tab row into a **fixed bottom tab bar on mobile** (thumb-reachable, 6 tabs with icon + label, 44×44 min tap target, safe-area-inset-bottom padding).
- Keep the top bar on mobile for brand + compact level chip + Gubby toggle only.
- On `md+` keep the current horizontal tab row; on `xl+` optionally promote to a shadcn `Sidebar` with `SidebarTrigger` in the header.
- Use the grid + `min-w-0` + `shrink-0` header pattern so brand/level never clip.

## 3. Module shell + layout consistency

- Introduce a shared `<ModuleShell title actions gubbyHint>` wrapper used by Compiler, To-Do, Focus Timer, Calendar, Weekly, Habits — consistent padding, header row, `rounded-2xl`, `card-shadow`, `bg-surface-sunken`.
- Add empty-states (illustration + one-line copy + primary CTA) for To-Do, Calendar, Habits.
- Use `h-dvh` instead of `h-screen` for full-height sections so mobile browser chrome doesn't cut them off.

## 4. Typography scale

- Define utility classes for display / h1 / h2 / body / caption with Fredoka for headings, Nunito for body, `tabular-nums` for all counters (XP, timer, level, streaks).
- Enforce one `<h1>` per route and no skipped heading levels.

## 5. Motion & micro-interactions

- Wrap the active-tab content in `AnimatePresence` for a subtle cross-fade between modules.
- Trigger `canvas-confetti` (already installed, unused) on task completion and habit-streak milestones.
- Add a breathing pulse on the Focus Timer ring while running.
- Respect `prefers-reduced-motion` (global rule already exists — verify per-component `motion` usage honors it).

## 6. Focus Timer polish

- Center a single large SVG progress ring as the hero, hide chrome during an active session, mute Gubby chatter automatically.

## 7. Gubby companion

- Anchor Gubby to a fixed bottom-right floating bubble (above the mobile tab bar) so he persists across modules without pushing layout.
- Add a "mute Gubby" toggle in the header; persist to localStorage (read in `useEffect`, not in `useState` initializer, to avoid SSR mismatch).

## 8. Accessibility (WCAG AA)

- `aria-label` on every icon-only button (nav tabs already have text; audit Toast close, Gubby toggle, timer controls, habit cells).
- Visible `:focus-visible` ring on all interactive controls using the brand token (currently defined globally — verify tabs, cells, chips).
- Ensure single `<main>` landmark in `__root.tsx` layout wrapping `<Outlet />`.
- Add `lang="en"` on `<html>` in `__root.tsx` head.
- Tap targets ≥ 44×44 on mobile (bottom tabs, habit day cells, calendar day cells).
- Replace any `div` with `onClick` by `<button>` (audit HabitTrackerModule, CalendarModule).
- Announce dynamic updates (toast, timer end) via `aria-live="polite"`.

## 9. SEO / PWA meta

- Set app-specific `<title>` and meta description in `__root.tsx` head: "Goblin Flow — Cozy focus OS for ADHD brains".
- Add `og:title`, `og:description`, `og:type`, `twitter:card` on the home route; wire `<link rel="manifest">` and `theme-color`.

## Suggested execution (two passes)

**Pass 1 — Foundation & responsiveness (biggest visual + a11y win):**
Sections 1, 2, 3, 4, 8, 9.

**Pass 2 — Delight & polish:**
Sections 5, 6, 7.

Say "go" for both passes, or name the sections you want.

## Notes for the technical reader

- All edits stay in `src/styles.css`, `src/components/*`, `src/routes/__root.tsx`, `src/routes/index.tsx`, and a new `src/components/ui/ModuleShell.tsx`. No changes to `src/lib/goblin-api.functions.ts`, hooks, or types.
- No new npm packages required; `motion`, `canvas-confetti`, `lucide-react`, and shadcn are already installed.
- Storage reads (Gubby mute, theme) go through `useEffect` / `useHydrated` to avoid SSR hydration mismatches.
