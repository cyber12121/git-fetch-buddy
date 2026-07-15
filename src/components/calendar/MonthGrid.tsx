import React from "react";
import { CalendarEvent } from "../../types";
import { MONTHS, DAYS_OF_WEEK, FilterType } from "./constants";

interface Props {
  year: number;
  month: number;
  todayDate: Date;
  selectedDate: string;
  filterType: FilterType;
  eventsByDay: Record<string, CalendarEvent[]>;
  expandedDates: Set<string>;
  onToggleExpanded: (dateStr: string) => void;
  onCellSelect: (day: number) => void;
  onEventClick: (e: React.SyntheticEvent, evt: CalendarEvent) => void;
}

function MonthGrid({
  year, month, todayDate, selectedDate, filterType, eventsByDay,
  expandedDates, onToggleExpanded, onCellSelect, onEventClick
}: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const formatDateString = (day: number) => {
    const mm = (month + 1).toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(
      <div key={`empty-${i}`} className="aspect-square md:aspect-auto md:min-h-[110px] bg-surface/40 border border-edge/50 rounded-lg" />
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateString(day);
    const isToday = todayDate.getDate() === day && todayDate.getMonth() === month && todayDate.getFullYear() === year;
    const isSelected = dateStr === selectedDate;
    const dayEvents = eventsByDay[dateStr] || [];
    const expanded = expandedDates.has(dateStr);
    const MAX_VISIBLE = 3;
    const visibleEvents = expanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE);
    const hiddenCount = dayEvents.length - visibleEvents.length;

    cells.push(
      <div
        key={`day-${day}`}
        role="button"
        tabIndex={0}
        aria-label={`Select day ${day} of ${MONTHS[month]} ${year}`}
        onClick={() => onCellSelect(day)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCellSelect(day);
          }
        }}
        className={`aspect-square md:aspect-auto md:min-h-[110px] p-0.5 md:p-1 border rounded-lg md:rounded-xl transition-all cursor-pointer flex flex-col items-stretch group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${expanded ? "relative z-10" : ""} ${
          isToday
            ? "ring-2 ring-[#F27D26] ring-offset-2 border-orange-200 bg-orange-50/20 shadow-[0_0_12px_rgba(242,125,38,0.35)]"
            : isSelected
            ? "border-brand bg-brand-soft/15 ring-2 ring-[#F27D26]/20 shadow-xs"
            : "border-edge bg-surface hover:bg-brand-soft/5"
        }`}
      >
        <div className="flex justify-between items-center md:px-1">
          <span className={`text-[11px] md:text-xs font-bold font-fredoka ${isToday ? "text-white bg-brand rounded-full w-5 h-5 flex items-center justify-center" : "text-ink-muted"}`}>
            {day}
          </span>
          <button
            id={`add-btn-${day}`}
            onClick={(e) => { e.stopPropagation(); onCellSelect(day); }}
            className="hidden md:inline-block opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-[9px] md:text-[10px] font-extrabold text-white bg-brand hover:bg-brand-hover px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
          >
            {filterType === "task" ? "+ Task 🎯" : filterType === "event" ? "+ Event 📌" : "+ Add 🌟"}
          </button>
        </div>

        {dayEvents.length > 0 && (
          <div className="flex md:hidden items-end justify-center gap-0.5 flex-1 pb-1">
            {dayEvents.slice(0, 3).map((evt) => (
              <span key={`dot-${evt.id}`} className={`w-1.5 h-1.5 rounded-full border ${evt.color}`} aria-hidden="true" />
            ))}
            {dayEvents.length > 3 && (
              <span className="text-[8px] font-bold text-ink-muted leading-none ml-0.5">+{dayEvents.length - 3}</span>
            )}
          </div>
        )}

        <div className="hidden md:flex flex-col flex-1 min-h-0">
          <div className={`mt-1 space-y-1 flex-1 pr-0.5 ${expanded ? "" : "max-h-[70px] overflow-hidden"}`}>
            {visibleEvents.map((evt) => (
              <div
                key={evt.id}
                role="button"
                tabIndex={0}
                onClick={(e) => onEventClick(e, evt)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEventClick(e, evt);
                  }
                }}
                className={`text-[10px] font-bold py-1 px-1.5 border truncate hover:scale-[1.02] transition-transform select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${evt.color}`}
                title={`${evt.time ? `[${evt.time}] ` : ""}${evt.title}`}
              >
                {evt.time && <span className="font-mono text-[9px] mr-0.5 opacity-80">{evt.time}</span>}
                {evt.type === "task" ? "🎯 " : "📌 "}{evt.title}
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(dateStr); }}
                className="w-full text-left text-[10px] font-bold text-brand bg-brand-soft/40 hover:bg-brand-soft/60 px-1.5 py-1 rounded truncate cursor-pointer transition-colors"
              >
                +{hiddenCount} more
              </button>
            )}
            {expanded && dayEvents.length > MAX_VISIBLE && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleExpanded(dateStr); }}
                className="w-full text-left text-[10px] font-bold text-ink-muted hover:text-ink px-1.5 py-1 rounded truncate cursor-pointer transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block">
      <div className="grid grid-cols-7 gap-1.5 mt-4 text-center">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-xs font-bold text-ink-muted py-1 font-fredoka uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-2">{cells}</div>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-edge text-xs text-ink-muted">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-100 rounded-full border border-emerald-200"></span><span>Task Quests</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-100 rounded-full border border-amber-200"></span><span>Manual Events</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-sky-50 rounded-full border border-sky-200"></span><span>Google Calendar Events</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-surface-raised rounded-full border border-edge-soft"></span><span>Completed Quests</span></div>
      </div>
    </div>
  );
}

export default React.memo(MonthGrid);
