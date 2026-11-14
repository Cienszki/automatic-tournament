import { describe, expect, it } from 'vitest';
import { REDACTED, isSecretKey, scrub, scrubString } from './scrub';

const JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjF9.c2lnbmF0dXJlLXBhcnQ';
const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/AbCdEf-ghIJkl_MNOP';

describe('scrub by key', () => {
  it('replaces secret fields at any depth and keeps the rest', () => {
    const input = {
      tournamentId: 't1',
      user: { id: 'u1', email: 'gracz@example.com', profile: { password: 'hunter2', nick: 'Miracle' } },
      list: [{ accessToken: 'abc' }, { apiKey: 'k' }, { sessionId: 'lobby-7' }],
    };
    expect(scrub(input)).toEqual({
      tournamentId: 't1',
      user: { id: 'u1', email: REDACTED, profile: { password: REDACTED, nick: 'Miracle' } },
      list: [{ accessToken: REDACTED }, { apiKey: REDACTED }, { sessionId: 'lobby-7' }],
    });
  });

  it('treats header spellings alike', () => {
    for (const key of ['Authorization', 'authorization', 'X-Api-Key', 'api_key', 'Cookie', 'set-cookie',
      'client_secret', 'FIREBASE_SERVICE_ACCOUNT_BASE64', 'ALERT_DISCORD_WEBHOOK_URL', 'SENTRY_DSN_WEB', 'session']) {
      expect(isSecretKey(key), key).toBe(true);
    }
    for (const key of ['tournamentId', 'matchId', 'sessionId', 'code', 'status', 'userAgent']) {
      expect(isSecretKey(key), key).toBe(false);
    }
  });

  it('scrubs a Headers object into a plain object', () => {
    const headers = new Headers({ authorization: `Bearer ${JWT}`, 'content-type': 'application/json', cookie: '__session=x' });
    expect(scrub({ headers })).toEqual({
      headers: { authorization: REDACTED, 'content-type': 'application/json', cookie: REDACTED },
    });
  });

  it('scrubs plain header objects the way Sentry stores a request', () => {
    const request = {
      url: 'https://dota2inhouse.pl/pdl-s2/teams?token=abc123&v=2',
      headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==', 'User-Agent': 'Mozilla/5.0', Referer: 'https://x.pl/?key=zzz' },
      cookies: { __session: 'abc' },
    };
    expect(scrub(request)).toEqual({
      url: `https://dota2inhouse.pl/pdl-s2/teams?token=${REDACTED}&v=2`,
      headers: { Authorization: REDACTED, 'User-Agent': 'Mozilla/5.0', Referer: `https://x.pl/?key=${REDACTED}` },
      cookies: REDACTED,
    });
  });

  it('leaves empty secret fields alone so their absence stays visible', () => {
    expect(scrub({ password: '', token: null, secret: undefined })).toEqual({ password: '', token: null, secret: undefined });
  });
});

describe('scrub by value', () => {
  it('removes tokens, e-mail addresses and credentials from free text', () => {
    const text = [
      `Authorization: Bearer ${JWT}`,
      `id token ${JWT}`,
      'contact admin.ligi+pdl@gmail.com',
      'postgres://postgres.abc:SuperSecret1@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      'https://0123456789abcdef@o1.ingest.de.sentry.io/42',
      `posting to ${WEBHOOK}`,
      'key AIzaSyA1234567890abcdefghijklmnopqrstu',
    ].join('\n');
    const out = scrubString(text);
    expect(out).not.toContain(JWT);
    expect(out).not.toContain('gmail.com');
    expect(out).not.toContain('SuperSecret1');
    expect(out).not.toContain('0123456789abcdef');
    expect(out).not.toContain('AbCdEf-ghIJkl_MNOP');
    expect(out).not.toContain('AIzaSy');
    expect(out).toContain('Bearer [redacted]');
    expect(out).toContain('[email]');
    expect(out).toContain('postgres://[redacted]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
    expect(out).toContain(`https://discord.com/api/webhooks/${REDACTED}`);
  });

  it('keeps ordinary text, ids and stack paths intact', () => {
    const text = 'Match 8012345678 failed at /app/node_modules/@sentry/core/index.js (team "OG")';
    expect(scrubString(text)).toBe(text);
  });
});

describe('scrub of errors', () => {
  it('turns an error into name, message and stack with secrets removed', () => {
    const err = new Error(`login failed for gracz@example.com with ${JWT}`);
    const out = scrub({ err }) as { err: { name: string; message: string; stack?: string } };
    expect(out.err.name).toBe('Error');
    expect(out.err.message).toBe('login failed for [email] with [redacted]');
    expect(out.err.stack).not.toContain(JWT);
    expect(out.err.stack).not.toContain('gracz@example.com');
  });

  it('follows the cause chain', () => {
    const err = new Error('outer', { cause: new TypeError('inner password=hunter2 for a@b.pl') });
    const out = scrub(err) as unknown as { cause: { name: string; message: string } };
    expect(out.cause.name).toBe('TypeError');
    expect(out.cause.message).toBe('inner password=[redacted] for [email]');
  });
});

describe('scrub safety', () => {
  it('does not mutate the input', () => {
    const input = { token: 'abc', nested: { email: 'a@b.pl' } };
    scrub(input);
    expect(input).toEqual({ token: 'abc', nested: { email: 'a@b.pl' } });
  });

  it('survives cycles, bigints and dates', () => {
    const a: Record<string, unknown> = { n: 10n, at: new Date('2026-11-13T10:00:00Z') };
    a.self = a;
    expect(scrub(a)).toEqual({ n: '10', at: '2026-11-13T10:00:00.000Z', self: '[circular]' });
  });
});
