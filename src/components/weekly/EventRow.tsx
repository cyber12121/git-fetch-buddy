import { memo } from "react";
import { Trash2 } from "lucide-react";
import type { CalendarEvent } from "../../types";

interface EventRowProps {
  evt: CalendarEvent;
  onDelete: (id: string) => void;
}

/**
 * Read-only calendar event row (pinned above tasks for the day).
 * Deletion is the only mutation exposed here — event editing lives elsewhere.
 */
function EventRowImpl({ evt, onDelete }: EventRowProps) {
  return (
    <div className="group flex items-center w-full px-2 border-b border-edge/60" style={{ minHeight: 36 }}>
      <span className="text-xs mr-1.5 shrink-0" aria-hidden>📌</span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-ink font-normal">{evt.title}</span>
        {evt.time && <span className="block text-[10px] text-brand font-mono">{evt.time}</span>}
      </div>
      <button
        type="button"
        aria-label={`Delete event ${evt.title}`}
        onClick={() => onDelete(evt.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-soft text-ink-muted hover:text-danger transition-all cursor-pointer"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export const EventRow = memo(EventRowImpl);
