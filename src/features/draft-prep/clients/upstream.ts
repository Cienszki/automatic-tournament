// Requests to OpenDota and STRATZ, which both go down or slow down without warning. Every call
// has a timeout and may share a time budget with the other calls of one request, so a page or an
// admin action answers within seconds instead of hanging until the host kills it (the old
// "Odśwież dane graczy" ended as an HTTP 502 that way).

export type UpstreamSource = 'opendota' | 'stratz';

export type UpstreamFailure =
  | 'timeout'
  | 'out_of_time'
  | 'unreachable'
  | 'rate_limited'
  | 'http'
  | 'bad_response'
  | 'not_configured';

/** Stable codes; the Polish text for each is `errors.<code>` in the message files */
export const UPSTREAM_CODES = {
  opendota: 'opendotaUnavailable',
  stratz: 'stratzUnavailable',
} as const satisfies Record<UpstreamSource, string>;

export type UpstreamCode = (typeof UPSTREAM_CODES)[UpstreamSource];

export class UpstreamError extends Error {
  readonly code: UpstreamCode;

  constructor(
    readonly source: UpstreamSource,
    readonly failure: UpstreamFailure,
    detail: string,
    readonly status?: number,
  ) {
    super(`${source} ${failure}: ${detail}`);
    this.name = 'UpstreamError';
    this.code = UPSTREAM_CODES[source];
  }
}

export interface Budget {
  remainingMs(): number;
}

/** A time budget shared by several calls; `now` is injectable for tests */
export function timeBudget(totalMs: number, now: () => number = Date.now): Budget {
  const end = now() + totalMs;
  return { remainingMs: () => end - now() };
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface CallOptions {
  timeoutMs: number;
  budget?: Budget;
}

/**
 * Fetches and parses JSON. The timeout covers reading the body too: a server that sends headers
 * and then stalls is as dead as one that never answers.
 */
export async function requestJson(
  source: UpstreamSource,
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  { timeoutMs, budget }: CallOptions,
): Promise<unknown> {
  const left = budget ? budget.remainingMs() : Infinity;
  const limit = Math.min(timeoutMs, left);
  const what = redact(url);
  if (limit <= 0) throw new UpstreamError(source, 'out_of_time', what);

  const controller = new AbortController();
  // Raced against each step, so the limit holds even for a fetch that ignores the signal
  const stopped = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  stopped.catch(() => undefined);
  const timer = setTimeout(() => controller.abort(), limit);
  try {
    let res: Response;
    try {
      res = await Promise.race([fetchFn(url, { ...init, signal: controller.signal, cache: 'no-store' }), stopped]);
    } catch (e) {
      throw failure(source, controller.signal.aborted, limit < timeoutMs, what, e);
    }
    if (!res.ok) {
      // An unread error body holds its connection until garbage collection; a sweep during an outage would pile them up
      void res.body?.cancel().catch(() => undefined);
      throw res.status === 429
        ? new UpstreamError(source, 'rate_limited', what, 429)
        : new UpstreamError(source, 'http', what, res.status);
    }
    try {
      return (await Promise.race([res.json(), stopped])) as unknown;
    } catch (e) {
      throw controller.signal.aborted
        ? failure(source, true, limit < timeoutMs, what, e)
        : new UpstreamError(source, 'bad_response', `${what}: body is not JSON`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function failure(source: UpstreamSource, aborted: boolean, budgetBound: boolean, what: string, e: unknown): UpstreamError {
  // Some fetch implementations put the whole URL, key included, into their error text
  if (!aborted) return new UpstreamError(source, 'unreachable', redact(`${what}: ${e instanceof Error ? e.message : String(e)}`));
  return new UpstreamError(source, budgetBound ? 'out_of_time' : 'timeout', what);
}

/** Keeps keys and tokens out of error messages and logs */
function redact(url: string): string {
  return url.replace(/([?&]api_key=)[^&]*/g, '$1***');
}
