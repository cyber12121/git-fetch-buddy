import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

export type ToastTone = "success" | "info" | "warn" | "cloud";

export interface Toast {
  id: number;
  message: string;
  icon?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (toast: { message: string; icon?: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Each tone is now visually distinct so success / info / cloud feedback can't
// be confused. Previously success, info, and cloud all shared one style.
const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-edge bg-surface text-ink",
  cloud: "border-sky-200 bg-sky-50 text-sky-800",
  warn: "border-red-200 bg-red-50 text-red-700",
};

// Long enough to read, but pausable on hover so an ADHD user who glances away
// doesn't lose the message.
const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, number>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const scheduleDismiss = useCallback(
    (id: number) => {
      const handle = window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
      timers.current.set(id, handle);
    },
    [remove]
  );

  const pauseDismiss = useCallback((id: number) => {
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback<ToastContextValue["pushToast"]>(
    ({ message, icon, tone = "info" }) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, icon, tone }]);
      scheduleDismiss(id);
    },
    [scheduleDismiss]
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        id="toast-stack"
        className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onMouseEnter={() => pauseDismiss(t.id)}
              onMouseLeave={() => scheduleDismiss(t.id)}
              className={`pointer-events-auto flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 shadow-lg font-nunito text-sm font-bold max-w-[320px] ${TONE_STYLES[t.tone]}`}
              role="status"
            >
              {t.icon && <span className="text-base leading-none">{t.icon}</span>}
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Dismiss notification"
                className="ml-1 -mr-1 shrink-0 rounded-full p-1 opacity-70 transition-colors hover:opacity-100 hover:bg-black/10 active:scale-90"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so a missing provider never crashes the app.
    return { pushToast: () => {} };
  }
  return ctx;
}
