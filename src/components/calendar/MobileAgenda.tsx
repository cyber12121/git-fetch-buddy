import React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarEvent } from "../../types";
import { toLocalDateKey } from "../../lib/constants";
import { DAYS_OF_WEEK } from "./constants";

interface Props {
  selectedDate: string;
  currentDate: Date;
  eventsByDay: Record<string, CalendarEvent[]>;
  onSelectDate: (key: string) => void;
  onSetCurrentDate: (d: Date) => void;
  onOpenAddFor: (d: Date) => void;
  onEventClick: (e: React.SyntheticEvent, evt: CalendarEvent) => void;
}

function MobileAgenda({
  selectedDate, currentDate, eventsByDay, onSelectDate, onSetCurrentDate, onOpenAddFor, onEventClick
}: Props) {
  const parseKey = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const selected = parseKey(selectedDate);
  const todayD = new Date();
  const weekStart = addDays(selected, -selected.getDay());
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shiftWeek = (delta: number) => {
    const next = addDays(selected, delta * 7);
    onSelectDate(toLocalDateKey(next));
    if (next.getMonth() !== currentDate.getMonth() || next.getFullYear() !== currentDate.getFullYear()) {
      onSetCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const agendaDays: Date[] = Array.from({ length: 14 }, (_, i) => addDays(selected, i));

  return (
    <div className="md:hidden mt-4">
      <div className="flex items-center gap-1 mb-4">
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          aria-label="Previous week"
          className="shrink-0 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-brand-soft/20 min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDays.map((d) => {
            const key = toLocalDateKey(d);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, todayD);
            const hasEvents = (eventsByDay[key] || []).length > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onSelectDate(key);
                  if (d.getMonth() !== currentDate.getMonth() || d.getFullYear() !== currentDate.getFullYear()) {
                    onSetCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                  }
                }}
                aria-pressed={isSel}
                aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl border transition-all min-h-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${
                  isSel
                    ? "bg-brand text-white border-brand shadow-md"
                    : isToday
                      ? "bg-brand-soft/30 border-brand/40 text-ink"
                      : "bg-surface border-edge text-ink-muted hover:bg-brand-soft/10"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isSel ? "text-white/90" : "text-ink-muted"}`}>
                  {DAYS_OF_WEEK[d.getDay()]}
                </span>
                <span className="text-base font-extrabold font-fredoka tabular-nums leading-none">{d.getDate()}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${hasEvents ? (isSel ? "bg-white" : "bg-brand") : "bg-transparent"}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          aria-label="Next week"
          className="shrink-0 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-brand-soft/20 min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-4 pb-24">
        {agendaDays.map((d) => {
          const key = toLocalDateKey(d);
          const list = eventsByDay[key] || [];
          const isToday = isSameDay(d, todayD);
          const isSel = isSameDay(d, selected);
          const headerLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
          return (
            <section key={key} aria-label={headerLabel}>
              <header className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className={`text-sm font-extrabold font-fredoka truncate ${isToday ? "text-brand" : "text-ink"}`}>
                    {isToday ? "Today · " : ""}{headerLabel}
                  </h3>
                  {list.length > 0 && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isSel ? "bg-brand-soft text-brand border-brand/30" : "bg-surface-sunken text-ink-muted border-edge"
                    }`}>
                      {list.length} {list.length === 1 ? "item" : "items"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAddFor(d)}
                  aria-label={`Add to ${headerLabel}`}
                  className="text-[11px] font-bold text-brand hover:text-brand-hover px-2 py-1 rounded-lg min-h-8"
                >
                  + Add
                </button>
              </header>
              {list.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenAddFor(d)}
                  className="w-full text-left text-xs text-ink-muted italic bg-surface-sunken/50 border border-dashed border-edge rounded-xl px-3 py-2.5 hover:bg-surface-sunken transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26]"
                >
                  Nothing scheduled — tap to add
                </button>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((evt) => (
                    <li key={`agenda-${evt.id}`}>
                      <button
                        type="button"
                        onClick={(e) => onEventClick(e, evt)}
                        className={`w-full flex items-center gap-2 text-left text-xs font-bold py-2.5 px-3 border rounded-xl min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] ${evt.color}`}
                      >
                        {evt.time && (
                          <span className="font-mono text-[10px] tabular-nums opacity-80 shrink-0 w-10">{evt.time}</span>
                        )}
                        <span className="shrink-0" aria-hidden="true">{evt.type === "task" ? "🎯" : "📌"}</span>
                        <span className="truncate flex-1">{evt.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onOpenAddFor(selected)}
        aria-label={`Add for ${selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg h-14 w-14 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F27D26] focus-visible:ring-offset-2"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default React.memo(MobileAgenda);
