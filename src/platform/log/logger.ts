// Structured logger. One call is one event with a dotted name and fields:
//
//   log.info('results.game_recorded', { tournamentId, matchId, gameId });
//
// On the server each call writes one JSON line (`time`, `level`, `event`, then the
// fields), which Vercel's log view and any log drain can filter by field. In the
// browser it writes to the console in a readable form. Fields always pass through
// the scrubber first, so a token or e-mail address in a field never reaches a line.

import { scrub } from './scrub';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export interface LogRecord {
  time: string;
  level: LogLevel;
  event: string;
  [field: string]: unknown;
}

/** Where finished records go. The default depends on where the code runs. */
export type LogWriter = (record: LogRecord) => void;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** A logger that adds `fields` to every record, e.g. `log.child({ tournamentId })`. */
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  writer?: LogWriter;
  /** Records below this level are dropped. Default: `LOG_LEVEL`, else `info`. */
  level?: LogLevel;
  now?: () => Date;
  fields?: LogFields;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const RESERVED_KEYS = new Set(['time', 'level', 'event']);

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LEVEL_ORDER;
}

export function defaultLevel(): LogLevel {
  const fromEnv = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined;
  return isLogLevel(fromEnv) ? fromEnv : 'info';
}

// The one place in new code where console output is allowed (WP-07's no-console
// rule must exempt this file).
export const jsonLineWriter: LogWriter = (record) => {
  const line = JSON.stringify(record);
  if (record.level === 'error') console.error(line);
  else if (record.level === 'warn') console.warn(line);
  else console.log(line);
};

export const browserConsoleWriter: LogWriter = (record) => {
  const { time: _time, level, event, ...fields } = record;
  const method = level === 'debug' ? 'debug' : level;
  console[method](`[${event}]`, fields);
};

function defaultWriter(): LogWriter {
  return typeof window === 'undefined' ? jsonLineWriter : browserConsoleWriter;
}

/** Builds a record. Exported for tests and for writers that forward records elsewhere. */
export function buildRecord(level: LogLevel, event: string, fields: LogFields, now: Date): LogRecord {
  const record: LogRecord = { time: now.toISOString(), level, event };
  const clean = scrub(fields);
  for (const [key, value] of Object.entries(clean)) {
    if (value === undefined) continue;
    // A field may not overwrite the record's own keys; it is kept under a prefix.
    record[RESERVED_KEYS.has(key) ? `field.${key}` : key] = value;
  }
  return record;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const writer = options.writer ?? defaultWriter();
  const threshold = LEVEL_ORDER[options.level ?? defaultLevel()];
  const now = options.now ?? (() => new Date());
  const bound = options.fields ?? {};

  const emit = (level: LogLevel) => (event: string, fields: LogFields = {}) => {
    if (LEVEL_ORDER[level] < threshold) return;
    try {
      writer(buildRecord(level, event, { ...bound, ...fields }, now()));
    } catch {
      // Logging must never break the caller (a field that cannot be serialised, a
      // closed stream). Nothing else is safe to do here.
    }
  };

  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    child: (fields) => createLogger({ ...options, writer, fields: { ...bound, ...fields } }),
  };
}
