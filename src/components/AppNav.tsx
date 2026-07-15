import { motion } from "motion/react";
import { Brain, Play, Calendar, CheckSquare, CalendarDays, Repeat, Sparkles } from "lucide-react";
import ThemeSwitcher from "./ThemeSwitcher";
import { useTheme } from "../lib/themes";

type GubbyMood = "happy" | "thoughtful" | "focused" | "cozy" | "excited";

interface TabDef {
  id: string;
  label: string;
  Icon: typeof Brain;
  msg: string;
  mood: GubbyMood;
  group: "do" | "plan";
}

const TABS: TabDef[] = [
  { id: "compiler", label: "Compiler", Icon: Brain, msg: "Dump all those messy thoughts here! Sprig will sweep and filter them.", mood: "thoughtful", group: "do" },
  { id: "todo", label: "To-Do", Icon: CheckSquare, msg: "Here are your active quests! Let's conquer them one micro-step at a time.", mood: "cozy", group: "do" },
  { id: "taskmaster", label: "Focus", Icon: Play, msg: "Welcome to the sensory-friendly Focus Timer! One thing at a time. No clutter.", mood: "focused", group: "do" },
  { id: "calendar", label: "Calendar", Icon: Calendar, msg: "Take a high-level look at your days! Plot tasks easily.", mood: "cozy", group: "plan" },
  { id: "weekly", label: "Weekly", Icon: CalendarDays, msg: "Let's map out your week!", mood: "cozy", group: "plan" },
  { id: "habits", label: "Habits", Icon: Repeat, msg: "Build tiny daily chains! Even a 1-day streak is a win 🌱", mood: "happy", group: "plan" },
];

interface AppNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  onPrefetchTab?: (tab: string) => void;
  xp: number;
}

export default function AppNav({ activeTab, onTabChange, onGubbyMessage, onPrefetchTab, xp }: AppNavProps) {
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const theme = useTheme();
  const isDark = theme === "kinetic-dark";

  const prefetch = (tab: TabDef) => onPrefetchTab?.(tab.id);

  const select = (tab: TabDef) => {
    onTabChange(tab.id);
    onGubbyMessage(tab.msg, tab.mood);
  };


  return (
    <>
      {/* ============ TOP BAR ============ */}
      <header
        className="sticky top-0 z-40 border-b border-edge/60 bg-secondary/85 backdrop-blur-md shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 md:flex md:flex-wrap md:justify-between">
            {/* Brand */}
            <div className="flex min-w-0 items-center gap-2.5">
              <motion.div
                animate={{ y: [0, -3, 0], rotate: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="shrink-0 drop-shadow"
                aria-hidden="true"
              >
                {isDark ? (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                    <Sparkles size={18} strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="text-2xl">🧝</span>
                )}
              </motion.div>
              <div className="min-w-0 leading-none">
                <h1 className="font-fredoka font-extrabold text-ink text-base tracking-tight truncate">
                  Momentum
                </h1>
                <div className="text-[10px] font-bold text-ink-muted uppercase tracking-widest truncate">
                  {isDark ? "kinetic focus OS" : "cozy focus OS"}
                </div>
              </div>
            </div>

            {/* Desktop tab row — ONLY on planning tabs (weekly/calendar/habits),
                since do-tabs already show the SideNav vertical switcher. Prevents
                duplicate tabs appearing horizontally AND vertically at once. */}
            {(activeTab === "calendar" || activeTab === "weekly" || activeTab === "habits") && (
              <nav
                aria-label="Primary"
                className="hidden lg:flex items-center gap-1 order-3 lg:order-none w-full lg:w-auto justify-center lg:justify-start mt-2 lg:mt-0"
              >
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => select(tab)}
                      onMouseEnter={() => prefetch(tab)}
                      onFocus={() => prefetch(tab)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-9 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-ink-muted hover:text-ink hover:bg-surface-sunken"
                      }`}
                    >
                      <tab.Icon size={14} aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}


            {/* Right side: XP + status */}
            <div className="flex items-center gap-2 shrink-0 justify-self-end">
              {/* Compact level chip (always visible) */}
              <div
                className="flex items-center gap-1.5 bg-surface-sunken/80 border border-edge rounded-full px-2.5 py-1 shadow-sm"
                aria-label={`Level ${level}, ${xpInLevel} of 100 experience`}
              >
                <span aria-hidden="true" className="text-xs">🌿</span>
                <span className="text-[11px] font-bold text-ink-muted tabular-nums">Lv.{level}</span>
                <div
                  className="hidden sm:block w-16 lg:w-24 h-2 rounded-full bg-edge overflow-hidden"
                  role="progressbar"
                  aria-valuenow={xpInLevel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${xpInLevel}%` }}
                  />
                </div>
                <span className="hidden sm:inline text-[10px] font-semibold text-ink-muted tabular-nums">
                  {xpInLevel}/100
                </span>
              </div>

              <ThemeSwitcher />

              <div className="hidden lg:flex items-center gap-1.5 bg-surface-sunken/80 border border-edge rounded-full px-3 py-1.5 shadow-sm">

                <span aria-hidden="true" className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                <span className="text-[11px] font-bold text-ink-muted">Sprig online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ MOBILE BOTTOM TAB BAR ============ */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-edge/70 bg-secondary/95 backdrop-blur-md shadow-[0_-4px_16px_-8px_rgba(45,58,45,0.15)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >

        <ul className="grid grid-cols-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id} className="flex">
                <button
                  type="button"
                  onClick={() => select(tab)}
                  onTouchStart={() => prefetch(tab)}
                  onFocus={() => prefetch(tab)}
                  aria-current={isActive ? "page" : undefined}

                  aria-label={tab.label}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[10px] font-bold transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-ink-muted hover:text-ink active:text-ink"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                      isActive ? "bg-primary/15" : ""
                    }`}
                  >
                    <tab.Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="truncate max-w-full px-0.5">{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
