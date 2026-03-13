// src/lib/error-reporting.ts
// Centralized error reporting utility
// Currently logs to console; configure with Sentry or similar in production.

interface ErrorReport {
  message: string;
  stack?: string;
  digest?: string;
  componentStack?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
}

type ErrorReportingProvider = (report: ErrorReport) => void;

let _provider: ErrorReportingProvider = defaultProvider;

function defaultProvider(report: ErrorReport): void {
  console.error('[ErrorReporting]', report.message, report);
}

/**
 * Configure the error reporting provider.
 * Call this once at app startup to integrate with Sentry, LogRocket, etc.
 *
 * @example
 * ```ts
 * import * as Sentry from '@sentry/nextjs';
 * configureErrorReporting((report) => {
 *   Sentry.captureException(new Error(report.message), {
 *     extra: report,
 *   });
 * });
 * ```
 */
export function configureErrorReporting(provider: ErrorReportingProvider): void {
  _provider = provider;
}

/**
 * Report an error to the configured provider.
 */
export function reportError(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const report: ErrorReport = {
    message: err.message,
    stack: err.stack,
    digest: (err as Error & { digest?: string }).digest,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    context,
  };

  try {
    _provider(report);
  } catch (providerError) {
    // Fallback to console if provider throws
    console.error('[ErrorReporting] Provider failed:', providerError);
    defaultProvider(report);
  }
}

/**
 * Report an error with a React component stack trace.
 * Designed for use in Error Boundaries.
 */
export function reportComponentError(
  error: Error,
  componentStack?: string,
  context?: Record<string, unknown>
): void {
  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    digest: (error as Error & { digest?: string }).digest,
    componentStack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    context,
  };

  try {
    _provider(report);
  } catch (providerError) {
    console.error('[ErrorReporting] Provider failed:', providerError);
    defaultProvider(report);
  }
}
