// Sentry set-up for the browser, the Node.js server and the edge runtime.
// With no DSN nothing is loaded and nothing is sent: `@sentry/nextjs` is imported
// dynamically only after a DSN is found, so a build without one also ships no
// Sentry SDK code on the first page load.
//
// The release is not set here: next.config.mjs passes the commit sha to
// `withSentryConfig`, which injects it into every bundle and `Sentry.init` reads it.

import { scrub } from '@/platform/log';
import { configureErrorReporting, type ErrorReport, type ErrorReportingProvider } from './error-reporting';
import { connectErrorContext, createSentryContextSink } from './context';

export type SentryRuntime = 'browser' | 'nodejs' | 'edge';

export interface SentrySettings {
  runtime: SentryRuntime;
  dsn?: string;
  /** Text from an env var; anything that is not a number in [0, 1] means 0. */
  tracesSampleRate?: string;
  environment?: string;
}

// Only the parts of the SDK this module uses, so tests can pass a fake.
export interface SentryApi {
  init(options: Record<string, unknown>): unknown;
  captureException(error: unknown, hint?: Record<string, unknown>): string;
  setTag(key: string, value: string | undefined): void;
  setUser(user: { id: string } | null): void;
}

export function parseSampleRate(value: string | undefined): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.min(n, 1) : 0;
}

type Scrubbable = Record<string, unknown>;

/** `beforeSend` for errors and transactions: the whole event goes through the scrubber. */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  return scrub(event);
}

// Header, cookie and query-string names the SDK must never collect. The scrubber
// runs afterwards on everything else.
const DENY = ['forwarded', '-ip', 'remote-', 'via', '-user', 'authorization', 'cookie', 'token', 'key', 'secret', 'password', 'code', 'session'];

export function buildSentryOptions(settings: SentrySettings): Record<string, unknown> | null {
  const dsn = settings.dsn?.trim();
  if (!dsn) return null;
  const rate = parseSampleRate(settings.tracesSampleRate);
  return {
    dsn,
    ...(settings.environment ? { environment: settings.environment } : {}),
    // Tracing is off unless a rate above 0 is set; 0 would still create spans.
    ...(rate > 0 ? { tracesSampleRate: rate } : {}),
    // v11 replaced `sendDefaultPii` with `dataCollection`; this is its "off" setting.
    dataCollection: {
      userInfo: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      httpBodies: [],
      cookies: false,
      httpHeaders: { deny: DENY },
      urlQueryParams: { deny: DENY },
    },
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: (crumb: Scrubbable) => scrub(crumb),
  };
}

const TAG_KEYS = ['tournamentId', 'tournamentSlug', 'userId', 'source', 'section'] as const;

export function createSentryProvider(sentry: Pick<SentryApi, 'captureException'>): ErrorReportingProvider {
  return (report: ErrorReport) => {
    const context = report.context ?? {};
    const tags: Record<string, string> = {};
    for (const key of TAG_KEYS) {
      const value = context[key];
      if (typeof value === 'string' && value) tags[key] = value;
    }
    sentry.captureException(report.error ?? new Error(report.message), {
      tags,
      extra: { context, digest: report.digest },
      ...(report.componentStack ? { contexts: { react: { componentStack: report.componentStack } } } : {}),
    });
  };
}

const loadSentry = () => import('@sentry/nextjs') as unknown as Promise<SentryApi>;

/**
 * Initialises Sentry when a DSN is set and connects reporting and context to it.
 * Returns whether it did; with no DSN the SDK is never loaded.
 */
export async function initSentry(settings: SentrySettings, load: () => Promise<SentryApi> = loadSentry): Promise<boolean> {
  const options = buildSentryOptions(settings);
  if (!options) return false;
  const sentry = await load();
  sentry.init(options);
  configureErrorReporting(createSentryProvider(sentry));
  connectErrorContext(createSentryContextSink(sentry));
  return true;
}
