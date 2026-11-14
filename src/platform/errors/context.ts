// The one helper that attaches the tournament and the user to error events.
// On the server Sentry keeps tags on the per-request isolation scope, so nothing is
// stored here: a module-level "current tournament" would leak between concurrent
// requests (CONVENTIONS section 5). In the browser there is one visitor, so the
// last context is kept and re-applied when Sentry finishes loading.

export interface ErrorContext {
  tournamentId?: string | null;
  tournamentSlug?: string | null;
  userId?: string | null;
}

export type ErrorContextSink = (context: ErrorContext) => void;

let sink: ErrorContextSink | null = null;
let browserContext: ErrorContext = {};

const isBrowser = () => typeof window !== 'undefined';

export function setErrorContext(context: ErrorContext): void {
  if (isBrowser()) browserContext = { ...browserContext, ...context };
  sink?.(context);
}

/** Called by `initSentry`; `null` disconnects (tests). */
export function connectErrorContext(next: ErrorContextSink | null): void {
  sink = next;
  if (next && isBrowser()) next(browserContext);
}

interface ScopeApi {
  setTag(key: string, value: string | undefined): void;
  setUser(user: { id: string } | null): void;
}

export function createSentryContextSink(sentry: ScopeApi): ErrorContextSink {
  return (context) => {
    if ('tournamentId' in context) sentry.setTag('tournamentId', context.tournamentId ?? undefined);
    if ('tournamentSlug' in context) sentry.setTag('tournamentSlug', context.tournamentSlug ?? undefined);
    if ('userId' in context) {
      sentry.setTag('userId', context.userId ?? undefined);
      // Only the id: no e-mail, name or address is ever sent.
      sentry.setUser(context.userId ? { id: context.userId } : null);
    }
  };
}

/** The tournament slug of a request path served by `/[tournamentSlug]/...`, else undefined. */
export function tournamentSlugFromRoute(routePath: string | undefined, path: string | undefined): string | undefined {
  if (!routePath?.startsWith('/[tournamentSlug]') || !path) return undefined;
  const first = path.split('?')[0].split('/')[1];
  return first ? decodeURIComponent(first) : undefined;
}
