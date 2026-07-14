import type { User } from "firebase/auth";

export type CloudStatus = "syncing" | "synced" | "error" | "local";

interface AppStatusBarProps {
  user: User | null;
  cloudStatus: CloudStatus;
}

/**
 * Desktop-only footer strip showing app + cloud sync state. Hidden on mobile
 * so the bottom tab bar owns that space.
 */
export default function AppStatusBar({ user, cloudStatus }: AppStatusBarProps) {
  return (
    <footer
      className="hidden md:flex fixed bottom-0 left-0 right-0 h-9 bg-surface-sunken/95 backdrop-blur-md border-t border-edge px-6 items-center justify-between text-[11px] font-bold text-ink-muted z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex gap-4 items-center">
        <span className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-brand rounded-full" /> Goblin Flow Active
        </span>
        {user && (
          <span className="flex items-center gap-1.5">
            {cloudStatus === "syncing" && (<><div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> Syncing…</>)}
            {cloudStatus === "synced"  && (<><div className="w-1.5 h-1.5 bg-sky-400 rounded-full" /> Cloud synced</>)}
            {cloudStatus === "error"   && (<><div className="w-1.5 h-1.5 bg-rose-400 rounded-full" /> Sync off</>)}
            {cloudStatus === "local"   && (<><div className="w-1.5 h-1.5 bg-surface-disabled rounded-full" /> Local only</>)}
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <span className="flex items-center gap-1.5 text-emerald-600/70">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Auto-saving
        </span>
      </div>
    </footer>
  );
}
