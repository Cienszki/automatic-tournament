// Shared helpers of the measuring scripts (WP-06): options, timed requests, cache headers, numbers.
// The scripts only read over HTTP, except invalidation.ts, which renames one team and back.

import fs from 'node:fs';

export type Options = Record<string, string[]>;

/** `--key value` pairs (repeatable) and bare `--flag`s, which get the value `true`. */
export function parseOptions(argv: readonly string[]): Options {
  const out: Options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next !== undefined && !next.startsWith('--') ? argv[++i] : 'true';
    (out[key] ??= []).push(value);
  }
  return out;
}

export function option(o: Options, key: string, fallback?: string): string {
  const v = o[key]?.at(-1) ?? fallback;
  if (v === undefined) throw new Error(`--${key} is required`);
  return v;
}

export const numberOption = (o: Options, key: string, fallback: number): number => {
  const n = Number(option(o, key, String(fallback)));
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${key} must be a number`);
  return n;
};

/** The base URL without a trailing slash; only http(s). */
export function baseUrl(o: Options): string {
  const raw = option(o, 'base', process.env.MEASURE_BASE_URL);
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('--base must be an http(s) URL');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/**
 * Headers sent with every request: `x-vercel-protection-bypass` when the preview is protected
 * (--bypass, or VERCEL_PROTECTION_BYPASS), and any `--header 'name: value'`.
 */
export function extraHeaders(o: Options): Record<string, string> {
  const out: Record<string, string> = {};
  const bypass = o.bypass?.at(-1) ?? process.env.VERCEL_PROTECTION_BYPASS;
  if (bypass && bypass !== 'true') out['x-vercel-protection-bypass'] = bypass;
  for (const h of o.header ?? []) {
    const i = h.indexOf(':');
    if (i <= 0) throw new Error(`--header must be "name: value", got ${h}`);
    out[h.slice(0, i).trim()] = h.slice(i + 1).trim();
  }
  return out;
}

let EXTRA: Record<string, string> = {};

/** Call once with the parsed options; every request made through this file then carries them. */
export function useExtraHeaders(o: Options): Record<string, string> {
  EXTRA = extraHeaders(o);
  return EXTRA;
}

/** The headers that say who answered and from which cache. */
export const CACHE_HEADERS = [
  'cache-control', 'age', 'x-vercel-cache', 'x-nextjs-cache', 'x-nextjs-prerender', 'x-nextjs-stale-time',
  'cdn-cache-control', 'vercel-cdn-cache-control', 'vary', 'content-type', 'x-vercel-id', 'server', 'x-matched-path',
  'x-platform-route', 'x-old-site',
] as const;

export interface Timed {
  url: string;
  status: number;
  /** Request start to response headers, in ms: the time to first byte as a client sees it. */
  ttfbMs: number;
  /** Request start to the last byte of the body. */
  totalMs: number;
  bytes: number;
  headers: Record<string, string>;
  body: string;
}

/** Client navigation and prefetch requests, as Next's router sends them. */
export const RSC_HEADERS = { RSC: '1' } as const;
export const PREFETCH_HEADERS = { RSC: '1', 'Next-Router-Prefetch': '1' } as const;

export async function timedFetch(url: string, init: { headers?: Record<string, string>; method?: string } = {}): Promise<Timed> {
  const start = performance.now();
  const res = await fetch(url, { method: init.method ?? 'GET', headers: { ...EXTRA, ...init.headers }, redirect: 'manual' });
  const ttfbMs = performance.now() - start;
  const body = await res.text();
  const totalMs = performance.now() - start;
  const headers: Record<string, string> = {};
  for (const name of CACHE_HEADERS) {
    const v = res.headers.get(name);
    if (v !== null) headers[name] = v;
  }
  return { url, status: res.status, ttfbMs: round(ttfbMs), totalMs: round(totalMs), bytes: Buffer.byteLength(body), headers, body };
}

/** HIT, MISS, STALE, PRERENDER... from the CDN's header, else from Next's own, else `-`. */
export function cacheStatus(t: Pick<Timed, 'headers'>): string {
  const vercel = t.headers['x-vercel-cache'];
  if (vercel) return `cdn:${vercel}`;
  const next = t.headers['x-nextjs-cache'];
  if (next) return `next:${next}`;
  return t.headers['x-nextjs-prerender'] ? 'next:PRERENDER' : '-';
}

/** Whether a shared cache (a CDN) may store the response, from its Cache-Control. */
export function sharedCacheable(cacheControl: string | undefined): boolean {
  if (!cacheControl) return false;
  const cc = cacheControl.toLowerCase();
  if (/\b(no-store|private|no-cache)\b/.test(cc)) return false;
  return /\bs-maxage=\d+/.test(cc) || /\bmax-age=[1-9]\d*/.test(cc);
}

/** What the second of two requests says about caching. */
export function cacheVerdict(second: Pick<Timed, 'headers'>): string {
  const vercel = second.headers['x-vercel-cache'];
  if (vercel) return ['HIT', 'STALE', 'PRERENDER'].includes(vercel) ? `served by the CDN (${vercel})` : `not from the CDN (${vercel})`;
  const next = second.headers['x-nextjs-cache'];
  if (next) return `no CDN header; Next's own cache says ${next}`;
  return 'no cache header at all';
}

export const round = (n: number, digits = 1): number => Math.round(n * 10 ** digits) / 10 ** digits;

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export interface Summary { n: number; min: number; p50: number; p95: number; max: number }

export function summarize(values: readonly number[]): Summary {
  return {
    n: values.length,
    min: round(Math.min(...values)),
    p50: round(percentile(values, 50)),
    p95: round(percentile(values, 95)),
    max: round(Math.max(...values)),
  };
}

export const formatSummary = (s: Summary): string => `n=${s.n} min ${s.min} · p50 ${s.p50} · p95 ${s.p95} · max ${s.max} ms`;

/** Writes the result as JSON when `--json <file>` is given. */
export function writeJson(o: Options, result: unknown): void {
  const file = o.json?.at(-1);
  if (file && file !== 'true') fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
}

/** The trial endpoints' bearer token, from --secret or PLATFORM_TRIAL_SECRET. */
export function trialSecret(o: Options): string | undefined {
  const v = o.secret?.at(-1) ?? process.env.PLATFORM_TRIAL_SECRET;
  return v && v !== 'true' ? v : undefined;
}

/**
 * Calls the hosting trial's invalidation endpoint. That endpoint and the trial's database probe
 * (concurrency.ts) were removed after WP-06 (2026-11-24); ttfb.ts, invalidation.ts and
 * concurrency.ts need an equivalent again, which WP-07's commands provide. Until then they only
 * run against a build of the trial branch's history.
 */
export async function invalidate(base: string, slug: string, secret: string, kind?: string): Promise<number> {
  const query = new URLSearchParams({ slug, ...(kind ? { kind } : {}) });
  const start = performance.now();
  const res = await fetch(`${base}/api/platform/trial/revalidate?${query}`, {
    method: 'POST', headers: { ...EXTRA, Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`invalidation failed: ${res.status} ${await res.text()}`);
  await res.arrayBuffer();
  return round(performance.now() - start);
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function run(main: () => Promise<void>): void {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
