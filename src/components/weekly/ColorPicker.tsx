import { memo } from "react";
import { Palette } from "lucide-react";
import { PILL_COLORS } from "./constants";

interface ColorPickerProps {
  taskId: string;
  activeId: string | null;
  onSet: (id: string, val: string) => void;
  onToggle: (id: string) => void;
}

/**
 * Small palette dropdown attached to each TaskRow — toggles a swatch menu
 * and calls back with the chosen color value ("" clears the pill).
 */
function ColorPickerImpl({ taskId, activeId, onSet, onToggle }: ColorPickerProps) {
  const isOpen = activeId === taskId;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Pick task color"
        aria-expanded={isOpen}
        onClick={(e) => { e.stopPropagation(); onToggle(taskId); }}
        className="p-1 rounded hover:bg-surface text-ink-muted hover:text-ink-2 transition-colors cursor-pointer"
      >
        <Palette size={12} />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-full mb-1 bg-surface border border-edge rounded-xl shadow-lg flex gap-1 p-1.5 z-50"
        >
          {PILL_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); onSet(taskId, c.value); }}
              style={{ background: c.bg || "#fff" }}
              className="w-4 h-4 rounded-full border border-edge hover:scale-125 transition-transform cursor-pointer flex items-center justify-center text-[9px] text-ink-muted font-bold"
              title={c.name}
            >
              {!c.value && "×"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ColorPicker = memo(ColorPickerImpl);
