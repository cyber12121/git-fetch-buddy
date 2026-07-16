import React, { type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label used in the fallback copy ("This section wobbled"). */
  label?: string;
  /**
   * Callback fired when the user clicks "Try again". Use this alongside a
   * `key` on the boundary to fully remount the wrapped subtree — clearing
   * lazy import errors that would otherwise stick.
   */
  onReset?: () => void;
}
interface ErrorBoundaryState {
  error: Error | null;
}

/** Heuristic: chunk-load failures shout out different messages per browser. */
function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.name} ${err.message}`.toLowerCase();
  return (
    msg.includes("chunkloaderror") ||
    msg.includes("loading chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed")
  );
}

/**
 * Graceful fallback so an unexpected throw doesn't white-screen the whole app.
 *
 * Two failure modes are handled distinctly:
 *   1. Chunk-load errors (deploy shipped, old client still has stale hashes)
 *      → offer a full page reload, which is the only real fix.
 *   2. Everything else → offer "Try again" that both resets local state and
 *      invokes `onReset` so the parent can bump a remount key.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Momentum crashed:", error);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  private reload = () => {
    try {
      window.location.reload();
    } catch {
      /* SSR / no-window */
    }
  };

  render(): ReactNode {
    if (this.state.error) {
      const chunk = isChunkLoadError(this.state.error);
      const label = this.props.label ?? "Something";
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8 text-center">
          <div className="bg-surface-sunken/90 rounded-2xl p-6 shadow-md max-w-md">
            <div className="text-3xl mb-2" aria-hidden="true">🍄</div>
            <h2 className="font-bold text-ink mb-1">
              {chunk ? "A fresh version is ready" : `${label} wobbled!`}
            </h2>
            <p className="text-sm text-ink-muted mb-3">
              {chunk
                ? "Momentum was updated in the background. Reload to grab the new bits — your tasks are safe."
                : "Sprig hit a snag. Try again — your tasks are safe in local storage."}
            </p>
            <button
              type="button"
              onClick={chunk ? this.reload : this.reset}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {chunk ? "Reload" : "Try again"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
