import React, { type ReactNode } from "react";

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { error: Error | null }

/**
 * Graceful fallback so an unexpected throw doesn't white-screen the whole app.
 * Extracted from App.tsx so any subtree can wrap itself in the same friendly
 * "something wobbled" surface without duplicating markup.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Momentum crashed:", error);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex items-center justify-center p-8 text-center">
          <div className="bg-surface-sunken/90 rounded-2xl p-6 shadow-md max-w-md">
            <div className="text-3xl mb-2" aria-hidden="true">🍄</div>
            <h2 className="font-bold text-ink mb-1">Something wobbled!</h2>
            <p className="text-sm text-ink-muted mb-3">
              Sprig hit a snag. Try refreshing — your tasks are safe in local storage.
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
