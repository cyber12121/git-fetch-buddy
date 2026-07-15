import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { THEMES, applyTheme, readStoredTheme, type ThemeId } from "../lib/themes";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("cozy-goblin");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = readStoredTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change theme"
        className="flex items-center gap-1.5 bg-surface-sunken/80 border border-edge rounded-full px-2.5 py-1 shadow-sm text-ink-muted hover:text-ink transition-colors min-h-8"
      >
        <Palette size={14} aria-hidden="true" />
        <span className="hidden sm:inline text-[11px] font-bold">Theme</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close theme menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-edge bg-card shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-edge/60">
              <p className="text-[11px] font-bold text-ink tracking-wide uppercase">Theme</p>
              <p className="text-[10px] text-ink-muted">Pick a vibe — saves automatically.</p>
            </div>
            <ul className="p-1">
              {THEMES.map((t) => {
                const active = t.id === theme;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => pick(t.id)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors ${
                        active ? "bg-surface-sunken" : "hover:bg-surface-sunken/60"
                      }`}
                    >
                      <span className="flex -space-x-1 shrink-0" aria-hidden="true">
                        {t.swatches.map((c, i) => (
                          <span
                            key={i}
                            className="w-4 h-4 rounded-full border border-edge"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-ink truncate">{t.name}</span>
                        <span className="block text-[10px] text-ink-muted truncate">{t.description}</span>
                      </span>
                      {active && <Check size={14} className="text-brand shrink-0" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
