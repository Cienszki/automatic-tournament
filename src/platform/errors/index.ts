// platform/errors: error reporting and the Sentry set-up.
// Owns: `reportError` / `reportComponentError` (provider-based, Sentry when a DSN is
// set, a log record otherwise), `setErrorContext` (tournament and user tags), and
// `initSentry`, called from src/instrumentation*.ts.
// Does not own: logging (platform/log) or alerts to people (platform/alerts).

export {
  configureErrorReporting,
  resetErrorReporting,
  reportError,
  reportComponentError,
} from './error-reporting';
export type { ErrorReport, ErrorReportingProvider } from './error-reporting';
export { setErrorContext, connectErrorContext, tournamentSlugFromRoute } from './context';
export type { ErrorContext } from './context';
export { initSentry, buildSentryOptions, parseSampleRate } from './sentry';
export type { SentryRuntime, SentrySettings } from './sentry';
