import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, FilterType } from "./constants";

interface Props {
  year: number;
  month: number;
  filterType: FilterType;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToday: () => void;
  onFilterChange: (f: FilterType) => void;
}

function CalendarToolbar({
  year, month, filterType, onPrevMonth, onNextMonth, onJumpToday, onFilterChange
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-edge">
      <div>
        <h2 className="text-2xl font-bold text-ink font-fredoka flex items-center gap-2">📅 Calendar</h2>
        <p className="text-sm text-ink-muted">Scheduled tasks auto-appear here. Click any day to add a task or event.</p>
      </div>

      <div className="flex flex-col sm:items-end gap-2.5 self-center sm:self-auto w-full sm:w-auto">
        <div className="flex items-center justify-between sm:justify-start gap-3 bg-surface-sunken p-1.5 rounded-2xl border-2 border-edge-soft w-full sm:w-auto">
          <button id="prev-month-btn" onClick={onPrevMonth} className="p-1.5 text-ink-muted hover:text-ink hover:bg-brand-soft/20 rounded-xl transition-all cursor-pointer">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm md:text-base font-bold text-ink font-fredoka min-w-[120px] text-center select-none">
            {MONTHS[month]} {year}
          </span>
          <button id="next-month-btn" onClick={onNextMonth} className="p-1.5 text-ink-muted hover:text-ink hover:bg-brand-soft/20 rounded-xl transition-all cursor-pointer">
            <ChevronRight size={18} />
          </button>
          <button id="today-month-btn" onClick={onJumpToday} className="px-2.5 py-1 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-xl shadow-xs transition-all cursor-pointer select-none">
            Today
          </button>
        </div>

        <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-edge-soft self-center sm:self-end w-full sm:w-auto justify-around sm:justify-start">
          {([
            { key: "all", id: "filter-all-btn", label: "🌟 All", active: "bg-brand text-white shadow-xs" },
            { key: "task", id: "filter-tasks-btn", label: "🎯 Tasks", active: "bg-emerald-600 text-white shadow-xs" },
            { key: "event", id: "filter-events-btn", label: "📌 Events", active: "bg-brand-hover text-white shadow-xs" }
          ] as const).map(btn => (
            <button
              key={btn.key}
              id={btn.id}
              onClick={() => onFilterChange(btn.key)}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold font-fredoka transition-all cursor-pointer ${
                filterType === btn.key ? btn.active : "text-ink-muted hover:text-ink hover:bg-surface-raised/50"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(CalendarToolbar);
