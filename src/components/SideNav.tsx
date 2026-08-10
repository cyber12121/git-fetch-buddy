import { Brain, Play, Calendar, CheckSquare, CalendarDays, Repeat, Info, Home } from "lucide-react";

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
  { id: "daily", label: "Today", Icon: Home, msg: "One day, one block at a time. Here's your plan.", mood: "focused", group: "do" },
  { id: "compiler", label: "Brain Dump", Icon: Brain, msg: "Dump all those messy thoughts here!", mood: "thoughtful", group: "do" },
  { id: "todo", label: "Quest Log", Icon: CheckSquare, msg: "Here are your active quests!", mood: "cozy", group: "do" },
  { id: "taskmaster", label: "Focus Timer", Icon: Play, msg: "One thing at a time. No clutter.", mood: "focused", group: "do" },
  { id: "calendar", label: "Calendar", Icon: Calendar, msg: "Plot your days.", mood: "cozy", group: "plan" },
  { id: "weekly", label: "Weekly", Icon: CalendarDays, msg: "Let's map out your week!", mood: "cozy", group: "plan" },
  { id: "habits", label: "Habits", Icon: Repeat, msg: "Build tiny daily chains 🌱", mood: "happy", group: "plan" },
];

interface SideNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGubbyMessage: (msg: string, mood: GubbyMood) => void;
  onPrefetchTab?: (tab: string) => void;
  taskCount?: number;
}

export default function SideNav({ activeTab, onTabChange, onGubbyMessage, onPrefetchTab, taskCount }: SideNavProps) {
  const select = (tab: TabDef) => {
    onTabChange(tab.id);
    onGubbyMessage(tab.msg, tab.mood);
  };

  const activeLabel = TABS.find(t => t.id === activeTab)?.label ?? "Active";

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
      {/* Main Focus panel */}
      <div className="bg-surface-sunken border border-edge rounded-3xl p-4 card-shadow">
        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.15em] px-2 pb-3">
          Main Focus
        </p>
        <ul className="flex flex-col gap-1.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isTodo = tab.id === "todo";
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => select(tab)}
                  onMouseEnter={() => onPrefetchTab?.(tab.id)}
                  onFocus={() => onPrefetchTab?.(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all min-h-11 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-ink-muted hover:text-ink hover:bg-surface"
                  }`}
                >
                  <tab.Icon size={16} aria-hidden="true" className="shrink-0" />
                  <span className="truncate text-left">{tab.label}</span>
                  {isActive && (
                    <span className="text-[10px] font-extrabold bg-brand text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Active
                    </span>
                  )}
                  {!isActive && isTodo && typeof taskCount === "number" && taskCount > 0 && (
                    <span className="text-[10px] font-bold text-ink-muted">
                      {taskCount} Left
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ADHD Focus Tip */}
      <div className="bg-surface-sunken border border-edge rounded-3xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-brand" aria-hidden="true" />
          <h3 className="text-sm font-bold text-ink font-fredoka">ADHD Focus Tip</h3>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Stuck in decision paralysis? Use the{" "}
          <strong className="text-ink">Brain Dump Compiler</strong> to get everything
          out of your head first. No organizing required yet!
        </p>
      </div>

      <span className="sr-only">Currently viewing: {activeLabel}</span>
    </aside>
  );
}
