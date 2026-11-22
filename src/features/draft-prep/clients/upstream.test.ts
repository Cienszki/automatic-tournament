// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import pl from '../../../../messages/pl.json';
import { requestJson, timeBudget, UpstreamError, UPSTREAM_CODES, type FetchFn } from './upstream';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** A server that never answers; it only stops when the request is aborted */
const hanging: FetchFn = (_url, init) =>
  new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));

async function failureOf(p: Promise<unknown>): Promise<UpstreamError> {
  const e = await p.then(() => null, (err: unknown) => err);
  expect(e).toBeInstanceOf(UpstreamError);
  return e as UpstreamError;
}

describe('requestJson', () => {
  it('returns the parsed body', async () => {
    await expect(requestJson('opendota', async () => json([1, 2]), 'https://x/a', {}, { timeoutMs: 1000 })).resolves.toEqual([1, 2]);
  });

  it('gives up on a server that does not answer within the timeout', async () => {
    const started = Date.now();
    const e = await failureOf(requestJson('opendota', hanging, 'https://x/a', {}, { timeoutMs: 30 }));
    expect(e.failure).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('gives up on a server that sends headers and then stalls', async () => {
    const stalled: FetchFn = async () => new Response(new ReadableStream({ start() {} }), { status: 200 });
    const e = await failureOf(requestJson('opendota', stalled, 'https://x/a', {}, { timeoutMs: 30 }));
    expect(e.failure).toBe('timeout');
  });

  it('does not call at all when the time budget is spent', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json([]));
    const e = await failureOf(requestJson('opendota', fetchFn, 'https://x/a', {}, { timeoutMs: 1000, budget: timeBudget(0) }));
    expect(e.failure).toBe('out_of_time');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stops at the end of the budget when it is shorter than the timeout', async () => {
    const e = await failureOf(requestJson('stratz', hanging, 'https://x/a', {}, { timeoutMs: 5000, budget: timeBudget(30) }));
    expect(e.failure).toBe('out_of_time');
  });

  it('tells a rate limit, a server error, an unreachable host and a broken body apart', async () => {
    expect((await failureOf(requestJson('opendota', async () => json({}, 429), 'https://x/a', {}, { timeoutMs: 100 }))).failure).toBe('rate_limited');
    const http = await failureOf(requestJson('opendota', async () => json({}, 503), 'https://x/a', {}, { timeoutMs: 100 }));
    expect([http.failure, http.status]).toEqual(['http', 503]);
    const down: FetchFn = async () => { throw new TypeError('fetch failed'); };
    expect((await failureOf(requestJson('opendota', down, 'https://x/a', {}, { timeoutMs: 100 }))).failure).toBe('unreachable');
    const html: FetchFn = async () => new Response('<html>Bad gateway</html>', { status: 200 });
    expect((await failureOf(requestJson('opendota', html, 'https://x/a', {}, { timeoutMs: 100 }))).failure).toBe('bad_response');
  });

  it('keeps the API key out of the error message', async () => {
    const e = await failureOf(requestJson('opendota', async () => json({}, 500), 'https://x/a?date=3&api_key=SECRET', {}, { timeoutMs: 100 }));
    expect(e.message).not.toContain('SECRET');
    expect(e.message).toContain('date=3');
  });

  it('carries a code whose Polish message tells the user plainly', async () => {
    const e = await failureOf(requestJson('opendota', hanging, 'https://x/a', {}, { timeoutMs: 10 }));
    expect(e.code).toBe(UPSTREAM_CODES.opendota);
    expect(pl.errors[e.code]).toBe('OpenDota nie odpowiada, spróbuj później');
    expect(pl.errors[UPSTREAM_CODES.stratz]).toBe('STRATZ nie odpowiada, spróbuj później');
  });
});
