import { memo } from "react";

type Filter = "date" | "all" | "someday";

interface Props {
  listFilter: Filter;
  onFilterChange: (f: Filter) => void;
  activeDate: string;
  onSelectDate: (d: string) => void;
  filteredCount: number;
  totalActive: number;
  completedCount: number;
  onSweepCompleted: () => void;
}

/**
 * Segmented filter (Date / All / Someday) plus a date picker
 * and a "sweep done" button. Purely presentational.
 */
function DateStripImpl(p: Props) {
  const filters: readonly { k: Filter; label: string }[] = [
    { k: "date", label: "Date" },
    { k: "all", label: "All" },
    { k: "someday", label: "Someday" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="inline-flex bg-surface-sunken border border-edge rounded-xl p-0.5">
        {filters.map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => p.onFilterChange(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${p.listFilter === k ? "bg-brand text-primary-foreground" : "text-ink-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {p.listFilter === "date" && (
        <input
          id="magic-todo-date-picker"
          type="date"
          value={p.activeDate}
          onChange={(e) => e.target.value && p.onSelectDate(e.target.value)}
          className="px-3 py-1.5 text-xs font-bold rounded-xl border border-edge bg-surface-sunken text-ink outline-none focus:border-brand cursor-pointer"
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">
          {p.filteredCount} · {p.totalActive} active
        </span>
        {p.completedCount > 0 && (
          <button
            id="clear-completed-todo-btn"
            onClick={p.onSweepCompleted}
            className="text-[11px] text-ink-muted hover:text-danger font-bold border border-edge hover:border-danger/40 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            Sweep done
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(DateStripImpl);
