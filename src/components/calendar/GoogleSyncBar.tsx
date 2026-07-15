import React from "react";
import { LogOut, AlertCircle } from "lucide-react";
import { User } from "firebase/auth";

interface Props {
  user: User | null;
  calendarConnected: boolean;
  isAnyLoading: boolean;
  googleError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSignOut: () => void;
}

function GoogleSyncBar({
  user, calendarConnected, isAnyLoading, googleError, onConnect, onDisconnect, onSignOut
}: Props) {
  return (
    <>
      <div className="bg-surface p-4 rounded-3xl border-2 border-edge card-shadow flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📅</div>
          <div>
            <h3 className="text-sm font-bold text-ink font-fredoka flex items-center gap-2">
              Google Calendar Sync
              {calendarConnected ? (
                <span className="text-[10px] bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold">Connected</span>
              ) : (
                <span className="text-[10px] bg-surface-raised text-ink-muted px-2.5 py-0.5 rounded-full font-bold">
                  {user ? "Account only" : "Disconnected"}
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-muted">
              {!user
                ? "Sign in with Google to sync your data and bring real events onto your cozy map."
                : calendarConnected
                  ? `Calendar syncing automatically as ${user.email || "your account"}!`
                  : `Signed in as ${user.email || "your account"}. Connect Google Calendar to see your real events here.`}
            </p>
          </div>
        </div>

        <div>
          {calendarConnected ? (
            <div className="flex items-center gap-3">
              {isAnyLoading && (
                <span className="text-xs text-ink-muted animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-brand rounded-full animate-ping"></span>
                  Syncing...
                </span>
              )}
              <button
                id="disconnect-google-btn"
                onClick={onDisconnect}
                disabled={isAnyLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold font-fredoka cursor-pointer transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={13} /> Disconnect
              </button>
              <button
                id="signout-google-btn"
                onClick={onSignOut}
                disabled={isAnyLoading}
                className="text-[11px] font-semibold text-ink-muted hover:text-stone-600 underline-offset-2 hover:underline cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              id="connect-google-btn"
              onClick={onConnect}
              disabled={isAnyLoading}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents" style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {user ? "Connect Google Calendar" : "Sign in & Connect Calendar"}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {googleError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-2xl flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
    </>
  );
}

export default React.memo(GoogleSyncBar);
