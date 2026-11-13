// @vitest-environment node
// The checked-in fixtures (fixtures/exports/<slug>): valid export format, no personal data,
// and published tables that the old code reproduces from the fixture itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readKindSync, readManifest, validateExport, type ExportRecord } from '../lib/format';
import { DROP_KEYS, FIREBASE_UID, USER_ID_KEYS, isFakeUserId, scanText } from '../lib/personal';
import { buildStandings, buildStatsTotals } from '../published/build';
import type { StatsDataset } from '@/lib/stats-lab/types';

const state = vi.hoisted(() => ({ dir: '' }));
vi.mock('@/server/lib/admin', async () => {
  const { fakeAdminDb } = await import('../published/fake-admin-db');
  return { ensureAdminInitialized: () => {}, getAdminDb: () => fakeAdminDb(state.dir) };
});

const ROOT = join(__dirname, '..', '..', '..', '..');
const FIXTURES = join(ROOT, 'fixtures', 'exports');
const SLUGS = readdirSync(FIXTURES).filter(f => statSync(join(FIXTURES, f)).isDirectory());

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

it('has the two fixtures WP-12 asks for', () => {
  expect(SLUGS).toEqual(expect.arrayContaining(['pdl-s2', 'wiosenna']));
});

describe.each(SLUGS)('fixture %s', slug => {
  const dir = join(FIXTURES, slug);

  it('is a valid capture in the export format', () => {
    const m = readManifest(dir);
    expect(m.slug).toBe(slug);
    expect(m.complete).toBe(true);
    expect(validateExport(dir).errors).toEqual([]);
    // Every line parses on its own, through the same parser the import tool uses
    for (const kind of Object.keys(m.collections)) expect(readKindSync(dir, kind)).toHaveLength(m.collections[kind].documents);
  });

  it('contains no e-mail address, token, Discord id or real user id', () => {
    const problems: string[] = [];
    for (const f of filesUnder(dir)) {
      for (const x of scanText(readFileSync(f, 'utf8'))) problems.push(`${relative(dir, f)}: ${x.what} ${x.sample}`);
    }
    expect(problems).toEqual([]);
  });

  it('has no personal field, and user references are fake ids', () => {
    const problems: string[] = [];
    const visit = (v: unknown, where: string, key: string | null) => {
      if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${where}/${i}`, key));
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (DROP_KEYS.test(k)) problems.push(`${where}/${k}: personal field`);
          visit(x, `${where}/${k}`, k);
        }
      } else if (typeof v === 'string' && key && USER_ID_KEYS.test(key) && v.length === 28 && !isFakeUserId(v)) {
        problems.push(`${where}: user id not replaced`);
      } else if (typeof v === 'string' && FIREBASE_UID.test(v) && /\d/.test(v)) {
        problems.push(`${where}: looks like a Firebase user id`);
      }
    };
    const m = readManifest(dir);
    for (const kind of Object.keys(m.collections)) {
      for (const r of readKindSync(dir, kind)) {
        visit(r.data, r.path, null);
        for (const seg of r.path.split('/')) if (FIREBASE_UID.test(seg)) problems.push(`${r.path}: user id in path`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('reproduces its published standings from the fixture', () => {
    expect(buildStandings(dir)).toEqual(readJson(join(dir, 'published', 'standings.json')));
  });

  it('stores a table for every division and group, with every team in one', () => {
    const st = readJson<ReturnType<typeof buildStandings>>(join(dir, 'published', 'standings.json'));
    const divisions = readKindSync(dir, 'divisions').map(r => r.path.split('/').pop());
    expect(st.tables.map(t => t.groupId).sort()).toEqual([...divisions].sort());
    expect(st.teamsOutsideTables).toEqual([]);
    const placed = st.tables.flatMap(t => t.order);
    expect(new Set(placed).size).toBe(readKindSync(dir, 'teams').length);
    for (const t of st.tables) expect(t.differences).toEqual([]);
  });

  it('reproduces its published stats totals from the stored dataset', () => {
    const ds = readJson<StatsDataset>(join(dir, 'published', 'stats-dataset.json'));
    const t = readJson<{ datasetGeneratedAt: string }>(join(dir, 'published', 'stats-totals.json'));
    const type = (readKindSync(dir, 'tournaments')[0]?.data.type as string | undefined) ?? null;
    const again = JSON.parse(JSON.stringify(buildStatsTotals(ds, type, readKindSync(dir, 'performanceRankings'))));
    expect(again).toEqual(t);
  });

  it('gives the live stats dataset when the old server code reads the fixture', async () => {
    state.dir = dir;
    const { buildStatsDataset } = await import('@/lib/stats-lab/build-dataset');
    const m = readManifest(dir);
    const fromFixture = await buildStatsDataset(m.tournamentId);
    const live = readJson<StatsDataset>(join(dir, 'published', 'stats-dataset.json'));
    // Players are collected in the order Firestore's parallel reads return; compare them as a set
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
    expect({ ...fromFixture, generatedAt: '', players: [...fromFixture.players].sort(byId) })
      .toEqual({ ...live, generatedAt: '', players: [...live.players].sort(byId) });
  });
});

describe('recorded OpenDota responses', () => {
  const dir = join(ROOT, 'fixtures', 'opendota');
  const index = readJson<{ matches: Array<{ matchId: string; fixture: string; why: string; status: number }> }>(join(dir, 'index.json'));

  it('has 8 to 10 responses for games that are in the fixtures', () => {
    expect(index.matches.length).toBeGreaterThanOrEqual(8);
    expect(index.matches.length).toBeLessThanOrEqual(10);
    for (const m of index.matches) {
      expect(m.status).toBe(200);
      const body = readJson<{ match_id: number; players: unknown[] }>(join(dir, `${m.matchId}.json`));
      expect(String(body.match_id)).toBe(m.matchId);
      expect(body.players).toHaveLength(10);
      const games = readKindSync(join(FIXTURES, m.fixture), 'matches.games').map(r => r.path.split('/').pop());
      expect(games).toContain(m.matchId);
    }
    for (const kind of ['normal parsed game', 'unparsed game', 'stand-in']) {
      expect(index.matches.some(m => m.why.includes(kind)), kind).toBe(true);
    }
  });

  it('holds only public match data', () => {
    const problems: string[] = [];
    for (const f of readdirSync(dir)) {
      for (const x of scanText(readFileSync(join(dir, f), 'utf8'))) problems.push(`${f}: ${x.what}`);
    }
    // Team logos are Steam UGC ids (fields and steamusercontent.com/ugc/ URLs): 17-20 digit numbers like a Discord id, and public
    const text = (f: string) => readFileSync(join(dir, f), 'utf8');
    const logoIds = readdirSync(dir).reduce((n, f) => n + (text(f).match(/"(?:radiant|dire)_logo":\d{17,20}|\/ugc\/\d{17,20}/g) ?? []).length, 0);
    expect(problems.filter(p => p.includes('Discord-style id')).length).toBe(logoIds);
    expect(problems.filter(p => !p.includes('Discord-style id'))).toEqual([]);
  });
});

it('records performanceRankings as the rankings view (stored by the old site, not computed)', () => {
  for (const slug of SLUGS) {
    const recs: ExportRecord[] = readKindSync(join(FIXTURES, slug), 'performanceRankings');
    expect(recs.length).toBeGreaterThan(0);
  }
});
