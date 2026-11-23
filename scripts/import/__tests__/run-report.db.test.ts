// @vitest-environment node
// What a run does around the tournaments: the test tournament is skipped unless named, every user
// of the owner's export is written (also one no tournament refers to), every global collection is
// accounted for, and a redacted report names no Steam id and no document path.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { renderReport, totalChanges } from '../report';
import { runImport, type RunOptions, type RunResult } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: [] };
const AT = '2026-10-01T10:00:00.000Z';
const LONER = 'user-0000000042';
const USED_PLAYER = '76561198117025892';

const line = (path: string, data: Record<string, unknown>) => JSON.stringify({ path, data, createTime: '2026-10-01T10:00:00.000000Z', updateTime: '2026-10-02T10:00:00.000000Z' });

function writeKind(dir: string, kind: string, lines: string[], status = 'ok'): void {
  writeFileSync(join(dir, `${kind}.jsonl`), lines.length ? `${lines.join('\n')}\n` : '');
  const file = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(file, 'utf8'));
  m.collections[kind] = { file: `${kind}.jsonl`, documents: lines.length, status, parentsListed: 1, ...(status === 'denied' ? { parentsDenied: 1 } : {}) };
  writeFileSync(file, JSON.stringify(m));
}

let dir: string;
let t: TestDb;
let result: RunResult;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'import-run-'));
  cpSync(join(ROOT, 'fixtures', 'import', 'letnia'), join(dir, 'letnia'), { recursive: true });
  // A capture of the test tournament: the pdl-s2 fixture under another slug.
  const test = join(dir, 'swiss-test');
  cpSync(join(ROOT, 'fixtures', 'exports', 'pdl-s2'), test, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(test, 'manifest.json'), 'utf8'));
  writeFileSync(join(test, 'manifest.json'), JSON.stringify({ ...manifest, slug: 'swiss-test' }));

  const global = join(dir, '_global');
  mkdirSync(global);
  writeFileSync(join(global, 'manifest.json'), JSON.stringify({
    format: 'dota2inhouse-firestore-export', version: 1, slug: '_global', tournamentId: null, root: '', layout: 'global',
    source: 'admin-sdk', projectId: 'test', capturedAt: AT, finishedAt: AT, complete: true, requests: 1, collections: {}, probes: [], notes: [],
  }));
  writeKind(global, 'players', [line(`players/${USED_PLAYER}`, { nickname: 'Yosa' }), line('players/76561198000000099', { nickname: 'Nikt' })]);
  writeKind(global, 'tournaments', [line('tournaments/iORcdaxjXRqrgRUEZhgP', { slug: 'swiss-test' }), line('tournaments/pdl-s1', { slug: 'pdl' })]);
  writeKind(global, 'users', [line(`users/${LONER}`, { uid: LONER, email: 'sam@example.com', displayName: 'Sam' })]);
  writeKind(global, 'accounts', [line(`accounts/${LONER}`, { nickname: 'Sam', discord: { id: '223456789012345678', username: 'sam', linkedAt: AT } })]);
  writeKind(global, 'cardDuels', [line('cardDuels/d1', { a: LONER })]);
  writeKind(global, 'steamLinks', [], 'denied');
  t = await createTestDb();
  result = await runImport(t.db, [dir], OPTIONS);
}, 120_000);
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('a run', () => {
  it('skips the test tournament, and says so', () => {
    expect(result.tournaments.map((x) => x.mapped.capture.slug)).toEqual(['letnia']);
    expect(result.skipped).toEqual([{ slug: 'swiss-test', reason: expect.stringMatching(/test tournament/) }]);
    expect(renderReport(result)).toMatch(/Not imported: swiss-test, a test tournament/);
  });

  it('writes every user of the owner\'s export, also one no tournament refers to', async () => {
    const [user] = await t.db.select().from(s.users).where(eq(s.users.id, LONER));
    expect(user).toMatchObject({ isStub: false, email: 'sam@example.com', nickname: 'Sam' });
    const links = await t.db.select().from(s.userLinks).where(eq(s.userLinks.userId, LONER));
    expect(links.map((l) => l.externalId)).toEqual(['223456789012345678']);
    expect(result.globalRun!.writes.find((w) => w.table === 'app.users')).toMatchObject({ inserted: 1 });
  });

  it('accounts for every global collection', () => {
    const use = Object.fromEntries(result.globalRun!.kinds.map((k) => [k.kind, k.use]));
    expect(Object.keys(use).sort()).toEqual(['accounts', 'cardDuels', 'players', 'steamLinks', 'tournaments', 'users']);
    expect(use.players).toMatch(/^1 used by the imported tournaments.*; 1 belong to no imported tournament/);
    expect(use.tournaments).toMatch(/swiss-test skipped.*pdl not in this run/);
    expect(use.cardDuels).toMatch(/WP-40/);
    expect(use.steamLinks).toMatch(/denied/);
  });

  it('shows a collection the adapter folded into another as such', () => {
    expect(renderReport(result)).toMatch(/\| groups \| \d+ \| → divisions \|/);
  });

  it('names no Steam id and no document path when redacted', () => {
    const full = renderReport(result);
    const redacted = renderReport(result, { redact: true });
    expect(full).toMatch(/tournaments\/letnia\//);
    expect(redacted).not.toMatch(/7656119\d{10}/);
    expect(redacted).not.toMatch(/tournaments\/letnia\//);
    expect(redacted).not.toMatch(/user-[0-9a-f]{10}/);
  });

  it('changes nothing the second time, global users included', async () => {
    expect(totalChanges(await runImport(t.db, [dir], OPTIONS))).toBe(0);
  });

  it('imports the test tournament when it is named', async () => {
    const other = await createTestDb();
    try {
      const named = await runImport(other.db, [join(dir, 'swiss-test')], { ...OPTIONS, include: ['swiss-test'] });
      expect(named.skipped).toEqual([]);
      expect(named.tournaments).toHaveLength(1);
    } finally {
      await other.close();
    }
  });
});
