import type React from "react";
import { memo } from "react";

interface AddInputProps {
  addRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  placeholder?: string;
}

/**
 * A single-line input that occupies one "ruled" row inside a day column.
 * The parent controls value + focus and decides what Enter/Blur mean.
 */
function AddInputImpl({ addRef, value, onChange, onKeyDown, onBlur, placeholder = "Write task…" }: AddInputProps) {
  return (
    <div
      className="flex items-center px-2 border-b border-edge/60"
      style={{ minHeight: 36 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={addRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-ink-muted py-1"
      />
    </div>
  );
}

export const AddInput = memo(AddInputImpl);
