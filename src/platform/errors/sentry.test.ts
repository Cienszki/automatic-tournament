import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSentryOptions, initSentry, parseSampleRate, type SentryApi } from './sentry';
import { connectErrorContext, setErrorContext, tournamentSlugFromRoute } from './context';
import { reportError, reportComponentError, resetErrorReporting } from './index';

function fakeSentry() {
  return {
    init: vi.fn(),
    captureException: vi.fn((_error: unknown, _hint?: Record<string, unknown>) => 'event-id'),
    setTag: vi.fn(),
    setUser: vi.fn(),
  } satisfies SentryApi;
}

afterEach(() => {
  resetErrorReporting();
  connectErrorContext(null);
});

describe('initSentry', () => {
  it('does not load or start Sentry without a DSN', async () => {
    const load = vi.fn(async () => fakeSentry());
    for (const dsn of [undefined, '', '   ']) {
      expect(await initSentry({ runtime: 'nodejs', dsn }, load)).toBe(false);
    }
    expect(load).not.toHaveBeenCalled();
  });

  it('starts Sentry with a DSN and routes reports to it', async () => {
    const sentry = fakeSentry();
    expect(await initSentry({ runtime: 'browser', dsn: 'https://k@o1.ingest.de.sentry.io/2' }, async () => sentry)).toBe(true);
    expect(sentry.init).toHaveBeenCalledOnce();
    const err = new Error('boom');
    reportError(err, { tournamentId: 't1', source: 'page', other: 5 });
    expect(sentry.captureException).toHaveBeenCalledWith(err, expect.objectContaining({
      tags: { tournamentId: 't1', source: 'page' },
    }));
    reportComponentError(new Error('render'), '<Page>');
    expect(sentry.captureException.mock.calls[1][1]).toMatchObject({ contexts: { react: { componentStack: '<Page>' } } });
  });

  it('sets the tournament and user tags through setErrorContext, re-applying the browser context on start', async () => {
    setErrorContext({ tournamentId: 't1', userId: 'u1' });
    const sentry = fakeSentry();
    await initSentry({ runtime: 'browser', dsn: 'https://k@o1.ingest.sentry.io/2' }, async () => sentry);
    expect(sentry.setTag).toHaveBeenCalledWith('tournamentId', 't1');
    expect(sentry.setTag).toHaveBeenCalledWith('userId', 'u1');
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });
    setErrorContext({ userId: null });
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);
  });
});

describe('buildSentryOptions', () => {
  it('collects no personal data, no replay and no tracing by default', () => {
    const options = buildSentryOptions({ runtime: 'nodejs', dsn: 'https://k@o1.ingest.sentry.io/2' })!;
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('sendDefaultPii');
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
    expect(options).not.toHaveProperty('integrations');
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpBodies: [] });
  });

  it('reads the trace rate from text, clamped to [0, 1]', () => {
    expect(parseSampleRate(undefined)).toBe(0);
    expect(parseSampleRate('abc')).toBe(0);
    expect(parseSampleRate('-1')).toBe(0);
    expect(parseSampleRate('0.05')).toBe(0.05);
    expect(parseSampleRate('7')).toBe(1);
    expect(buildSentryOptions({ runtime: 'edge', dsn: 'x', tracesSampleRate: '0.1' })).toHaveProperty('tracesSampleRate', 0.1);
  });

  it('beforeSend removes secrets from the whole event and keeps the tags', () => {
    const beforeSend = buildSentryOptions({ runtime: 'nodejs', dsn: 'x' })!.beforeSend as (e: object) => Record<string, unknown>;
    const event = {
      message: 'failed for gracz@example.com',
      tags: { tournamentId: 't1', userId: 'u1' },
      user: { id: 'u1', email: 'gracz@example.com' },
      request: { headers: { Authorization: 'Bearer abcdefghijk', 'User-Agent': 'x' }, query_string: 'token=zzz' },
      exception: { values: [{ type: 'Error', value: 'DATABASE_URL=postgres://u:pw@h/db' }] },
      extra: { context: { webhookUrl: 'https://discord.com/api/webhooks/1/abc' } },
    };
    const out = JSON.stringify(beforeSend(event));
    for (const secret of ['gracz@example.com', 'abcdefghijk', 'zzz', ':pw@', 'webhooks/1/abc']) {
      expect(out).not.toContain(secret);
    }
    expect(beforeSend(event)).toMatchObject({ tags: { tournamentId: 't1', userId: 'u1' }, user: { id: 'u1' } });
  });
});

describe('tournamentSlugFromRoute', () => {
  it('takes the slug only from tournament routes', () => {
    expect(tournamentSlugFromRoute('/[tournamentSlug]/teams', '/pdl-s2/teams?v=2')).toBe('pdl-s2');
    expect(tournamentSlugFromRoute('/creator', '/creator')).toBeUndefined();
    expect(tournamentSlugFromRoute(undefined, '/x')).toBeUndefined();
  });
});
