// Error reporting with a swappable provider. Code reports through `reportError`
// (or `reportComponentError` from an error boundary) and never imports Sentry: the
// Sentry provider is installed by `initSentry` when a DSN is set. Without one, the
// default provider writes the report as an `error.reported` log record.

import { log } from '@/platform/log';

export interface ErrorReport {
  message: string;
  stack?: string;
  digest?: string;
  componentStack?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
  /** The value that was thrown, so a provider can keep its type and stack. */
  error?: unknown;
}

export type ErrorReportingProvider = (report: ErrorReport) => void;

function defaultProvider(report: ErrorReport): void {
  const { error: _thrown, ...fields } = report;
  log.error('error.reported', fields);
}

let _provider: ErrorReportingProvider = defaultProvider;

/**
 * Configure the error reporting provider. `initSentry` calls this once at start-up
 * when a DSN is set; tests call it with a fake.
 */
export function configureErrorReporting(provider: ErrorReportingProvider): void {
  _provider = provider;
}

/** Puts the default provider back (tests). */
export function resetErrorReporting(): void {
  _provider = defaultProvider;
}

function buildReport(err: Error, original: unknown, componentStack?: string, context?: Record<string, unknown>): ErrorReport {
  return {
    message: err.message,
    stack: err.stack,
    digest: (err as Error & { digest?: string }).digest,
    componentStack,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    context,
    error: original,
  };
}

function deliver(report: ErrorReport): void {
  try {
    _provider(report);
  } catch (providerError) {
    log.error('error.provider_failed', { err: providerError });
    defaultProvider(report);
  }
}

/** Report an error to the configured provider. */
export function reportError(error: Error | unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  deliver(buildReport(err, err, undefined, context));
}

/**
 * Report an error with a React component stack trace.
 * Designed for use in Error Boundaries.
 */
export function reportComponentError(error: Error, componentStack?: string, context?: Record<string, unknown>): void {
  deliver(buildReport(error, error, componentStack, context));
}
