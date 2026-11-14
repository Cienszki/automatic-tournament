// platform/log: structured logging and the scrubber.
// Owns: the `log` helper (JSON lines on the server, console in the browser) and
// `scrub`, which removes tokens, passwords, authorization headers and e-mail
// addresses from anything that leaves the process (logs, Sentry events, alerts).
// Does not own: error reporting (platform/errors) or alerting (platform/alerts).
// Entry points: `log.info('area.event_name', { tournamentId, ... })`, `scrub(value)`.

import { createLogger } from './logger';

export const log = createLogger();

export { createLogger, buildRecord, jsonLineWriter, browserConsoleWriter } from './logger';
export type { Logger, LoggerOptions, LogFields, LogLevel, LogRecord, LogWriter } from './logger';
export { scrub, scrubString, isSecretKey, REDACTED } from './scrub';
