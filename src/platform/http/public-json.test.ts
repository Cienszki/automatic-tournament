// @vitest-environment node
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { publicJson } from './public-json';

const CACHE = { sMaxAge: 300, staleWhileRevalidate: 600 };
const body = { teams: Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, name: 'Drużyna' })) };

describe('publicJson', () => {
  it('compresses the body with gzip when the client accepts it', async () => {
    const res = publicJson(new Request('https://x.test/a', { headers: { 'Accept-Encoding': 'br, gzip' } }), body, CACHE);
    expect(res.headers.get('Content-Encoding')).toBe('gzip');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.length).toBeLessThan(JSON.stringify(body).length / 4);
    expect(JSON.parse(gunzipSync(bytes).toString('utf8'))).toEqual(body);
  });

  it('sends plain JSON to a client that does not accept gzip', async () => {
    const res = publicJson(new Request('https://x.test/a'), body, CACHE);
    expect(res.headers.get('Content-Encoding')).toBeNull();
    expect(await res.json()).toEqual(body);
  });

  it('lets the CDN keep the response, and varies it by encoding', () => {
    const res = publicJson(new Request('https://x.test/a'), body, CACHE);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    expect(res.headers.get('Vary')).toBe('Accept-Encoding');
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  });
});
