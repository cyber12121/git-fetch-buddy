import { memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekHeaderProps {
  title: string;
  showTimeBlocks: boolean;
  onToggleTimeBlocks: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

/**
 * Top bar of the planner: month title, time-blocks toggle, week navigation.
 * Presentational — all state lives in the parent hook.
 */
function WeekHeaderImpl({ title, showTimeBlocks, onToggleTimeBlocks, onPrevWeek, onNextWeek }: WeekHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 md:px-10 pt-8 pb-6">
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight leading-none select-none text-ink">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleTimeBlocks}
          aria-pressed={showTimeBlocks}
          className={`px-3 py-1.5 rounded-full font-semibold text-[11px] cursor-pointer transition-colors ${
            showTimeBlocks ? "bg-brand text-primary-foreground" : "text-ink-muted hover:text-ink"
          }`}
        >
          ⏱ Time Blocks: {showTimeBlocks ? "ON" : "OFF"}
        </button>

        <div className="flex items-center gap-1">
          <button
            id="prev-week-btn"
            type="button"
            aria-label="Previous week"
            onClick={onPrevWeek}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            id="next-week-btn"
            type="button"
            aria-label="Next week"
            onClick={onNextWeek}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const WeekHeader = memo(WeekHeaderImpl);
