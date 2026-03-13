"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportComponentError } from "@/lib/error-reporting";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Section name for error reporting context (e.g., "fantasy", "stats") */
  section?: string;
  /** Custom fallback UI. If omitted, a default error card is shown. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reusable React Error Boundary for wrapping feature sections.
 *
 * @example
 * ```tsx
 * <ErrorBoundary section="fantasy">
 *   <FantasyLeaderboard />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportComponentError(error, errorInfo.componentStack ?? undefined, {
      section: this.props.section,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback } = this.props;
    const error = this.state.error!;

    // Custom render-prop fallback
    if (typeof fallback === "function") {
      return fallback(error, this.handleReset);
    }

    // Custom static fallback
    if (fallback) {
      return fallback;
    }

    // Default fallback UI
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500 mb-3" />
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">
          Something went wrong
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {this.props.section
            ? `An error occurred in the ${this.props.section} section.`
            : "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        {process.env.NODE_ENV === "development" && error && (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/10 p-3 text-left text-xs text-red-600 dark:text-red-300">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
