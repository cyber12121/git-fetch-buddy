import { motion } from "motion/react";
import { Brain, Play, Calendar, CheckSquare, CalendarDays, Repeat } from "lucide-react";

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
  { id: "compiler", label: "Compiler", Icon: Brain, msg: "Dump all those messy thoughts here! Gubby will sweep and filter them.", mood: "thoughtful", group: "do" },
  { id: "todo", label: "To-Do", Icon: CheckSquare, msg: "Here are your active quests! Let's conquer them one micro-step at a time.", mood: "cozy", group: "do" },
  { id: "taskmaster", label: "Focus Timer", Icon: Play, msg: "Welcome to the sensory-friendly Focus Timer! One thing at a time. No clutter.", mood: "focused", group: "do" },
  { id: "calendar", label: "Calendar", Icon: Calendar, msg: "Take a high-level look at your days! Plot tasks easily.", mood: "cozy", group: "plan" },
  { id: "weekly", label: "Weekly", Icon: CalendarDays, msg: "Let's map out your week!", mood: "cozy", group: "plan" },
  { id: "habits", label: "Habits", Icon: Repeat, msg: "Build tiny daily chains! Even a 1-day streak is a win 🌱", mood: "happy", group: "plan" },
];

interface AppNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  xp: number;
}

export default function AppNav({ activeTab, onTabChange, onGubbyMessage, xp }: AppNavProps) {
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;

  const select = (tab: TabDef) => {
    onTabChange(tab.id);
    onGubbyMessage(tab.msg, tab.mood);
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-edge/60 bg-gradient-to-r from-[#DCE8DC]/90 via-[#E8F2E8]/95 to-[#DCE8DC]/90 backdrop-blur-md shadow-sm transition-colors duration-150" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-3 py-2.5">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ y: [0, -3, 0], rotate: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl drop-shadow"
              >🧝</motion.div>
              <div className="leading-none">
                <div className="font-fredoka font-extrabold text-ink text-base tracking-tight">Goblin Flow</div>
                <div className="text-[10px] font-bold text-ink-muted/80 uppercase tracking-widest">cozy focus OS</div>
              </div>
            </div>

            {/* Mobile: compact level */}
            <div className="flex xl:hidden items-center gap-1.5">
              <div className="flex items-center gap-1.5 bg-surface/70 border border-edge rounded-full px-2.5 py-1">
                <span className="text-[10px] font-bold text-ink-muted">Lv.{level}</span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-50"></span>
              </div>
            </div>
          </div>

          {/* Center: Unified tab row — Do group · Plan group */}
          <div className="flex items-center gap-1.5 md:gap-2 bg-surface/50 p-1.5 rounded-2xl shadow-sm border border-white/60 overflow-x-auto w-full xl:w-auto no-scrollbar scroll-smooth">

            {TABS.map((tab, i) => {
              const isActive = activeTab === tab.id;
              const showDivider = tab.group === "plan" && TABS[i - 1]?.group === "do";
              return (
                <span key={tab.id} className="flex items-center shrink-0">
                  {showDivider && <span className="w-[2px] h-6 bg-surface/60 rounded-full shrink-0"></span>}
                  <motion.button
                    id={`nav-tab-${tab.id}`}
                    onClick={() => select(tab)}
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer select-none ${
                      isActive
                        ? "bg-gradient-to-r from-[#F27D26] to-[#FF9D4E] text-white shadow-md ring-2 ring-[#F27D26]/30 border border-brand/50"
                        : "bg-surface/80  text-ink-muted  hover:bg-surface  hover:text-ink  shadow-sm border border-edge-soft    "
                    }`}
                  >
                    <tab.Icon size={13} /><span>{tab.label}</span>
                  </motion.button>
                </span>
              );
            })}
          </div>

          {/* Desktop: XP bar + live status */}
          <div className="hidden xl:flex items-center gap-3 shrink-0">
            {/* XP / Level progress */}
            <div className="flex items-center gap-2 bg-surface/70 border border-edge rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-xs">🌿</span>
              <span className="text-[11px] font-bold text-ink-muted tabular-nums">Lv.{level}</span>
              <div className="w-24 h-2 rounded-full bg-[#E6EEE6] overflow-hidden" role="progressbar" aria-valuenow={xpInLevel} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-gradient-to-r from-[#F27D26] to-[#FF9D4E] transition-all duration-500" style={{ width: `${xpInLevel}%` }} />
              </div>
              <span className="text-[10px] font-semibold text-ink-muted tabular-nums">{xpInLevel}/100</span>
            </div>

            <div className="flex items-center gap-1.5 bg-surface/70 border border-edge rounded-full px-3 py-1.5 shadow-sm">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-50"></span>
              <span className="text-[11px] font-bold text-ink-muted">Gubby online</span>
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
