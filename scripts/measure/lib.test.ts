import { describe, expect, it } from 'vitest';
import { cacheStatus, cacheVerdict, extraHeaders, parseOptions, percentile, sharedCacheable, summarize } from './lib';

describe('parseOptions', () => {
  it('collects repeated options and bare flags', () => {
    expect(parseOptions(['--path', '/a', '--path', '/b', '--rsc', '--n', '5'])).toEqual({ path: ['/a', '/b'], rsc: ['true'], n: ['5'] });
  });
  it('refuses a stray argument', () => {
    expect(() => parseOptions(['/a'])).toThrow(/unexpected/);
  });
});

describe('percentile and summarize', () => {
  it('takes the nearest rank', () => {
    const values = [5, 1, 4, 2, 3];
    expect(percentile(values, 50)).toBe(3);
    expect(percentile(values, 95)).toBe(5);
    expect(summarize(values)).toEqual({ n: 5, min: 1, p50: 3, p95: 5, max: 5 });
  });
});

describe('cache headers', () => {
  it("prefers the CDN's header over Next's", () => {
    expect(cacheStatus({ headers: { 'x-vercel-cache': 'HIT', 'x-nextjs-cache': 'MISS' } })).toBe('cdn:HIT');
    expect(cacheStatus({ headers: { 'x-nextjs-cache': 'HIT' } })).toBe('next:HIT');
    expect(cacheStatus({ headers: {} })).toBe('-');
  });

  it('tells a cacheable Cache-Control from a private one', () => {
    expect(sharedCacheable('s-maxage=31536000, stale-while-revalidate')).toBe(true);
    expect(sharedCacheable('public, max-age=0, must-revalidate')).toBe(false);
    expect(sharedCacheable('private, no-cache, no-store, max-age=0, must-revalidate')).toBe(false);
    expect(sharedCacheable(undefined)).toBe(false);
  });

  it('says whether the second request came from the CDN', () => {
    expect(cacheVerdict({ headers: { 'x-vercel-cache': 'HIT' } })).toMatch(/^served by the CDN/);
    expect(cacheVerdict({ headers: { 'x-vercel-cache': 'MISS' } })).toMatch(/^not from the CDN/);
    expect(cacheVerdict({ headers: { 'x-nextjs-cache': 'HIT' } })).toMatch(/Next's own cache says HIT/);
  });
});

describe('extraHeaders', () => {
  it('sends the protection bypass and any header given', () => {
    expect(extraHeaders(parseOptions(['--bypass', 'abc', '--header', 'x-a: 1']))).toEqual({ 'x-vercel-protection-bypass': 'abc', 'x-a': '1' });
    expect(() => extraHeaders(parseOptions(['--header', 'nocolon']))).toThrow(/name: value/);
  });
});
