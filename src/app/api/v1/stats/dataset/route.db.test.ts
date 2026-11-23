// @vitest-environment node
// The endpoint on an imported fixture: the dataset of the stats feature, gzipped, CDN-cacheable.

import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TestDb } from '@/platform/db/testing';
import { getDataset } from '@/features/stats/queries';
import { importedDb, TOURNAMENT_ID } from '@/features/stats/testing/imported';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/platform/db/client', () => ({ getDb: () => state.db }));

const { GET } = await import('./route');

let t: TestDb;
beforeAll(async () => {
  t = await importedDb(['pdl-s2']);
  state.db = t.db;
}, 120_000);
afterAll(() => t.close());

const call = (query: string, headers: Record<string, string> = {}) => GET(new Request(`https://x.test/api/v1/stats/dataset${query}`, { headers }));

describe('GET /api/v1/stats/dataset', () => {
  it('serves the tournament dataset gzipped, for the CDN to keep', async () => {
    const res = await call(`?tournamentId=${TOURNAMENT_ID['pdl-s2']}`, { 'Accept-Encoding': 'gzip' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Encoding')).toBe('gzip');
    expect(res.headers.get('Cache-Control')).toMatch(/^public, max-age=0, s-maxage=300, stale-while-revalidate=600$/);
    const body = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8'));
    const expected = await getDataset(TOURNAMENT_ID['pdl-s2'], t.db);
    expect({ ...body, generatedAt: '' }).toEqual({ ...expected, generatedAt: '' });
    expect(body.games).toHaveLength(24);
  });

  it('refuses a missing or malformed tournament id', async () => {
    expect((await call('')).status).toBe(400);
    expect((await call('?tournamentId=a%20b')).status).toBe(400);
  });

  it('answers 404 for a tournament that does not exist', async () => {
    expect((await call('?tournamentId=nope')).status).toBe(404);
  });
});
