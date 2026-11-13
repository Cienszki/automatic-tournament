// @vitest-environment node
// The published tables are computed by copies of the two hooks' code
// (published/old-division-table.ts, old-home-tables.ts). These tests fail when a hook changes
// and its copy does not, and pin the copies' behaviour on small hand-made cases.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExportRecord } from '../lib/format';
import { divisionTable } from '../published/old-division-table';
import { homeTables } from '../published/old-home-tables';
import { FirestoreTimestampLike, clientData, snapshot } from '../published/old-site-inputs';

const ROOT = join(__dirname, '..', '..', '..', '..');

/** The BEGIN COPY / END COPY blocks of a file, each as trimmed lines. */
function copiedBlocks(file: string): Array<{ source: string; lines: string[] }> {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const out: Array<{ source: string; lines: string[] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const begin = /\/\/ BEGIN COPY (\S+)/.exec(lines[i]);
    if (!begin) continue;
    const end = lines.findIndex((l, j) => j > i && /\/\/ END COPY/.test(l));
    out.push({ source: begin[1], lines: lines.slice(i + 1, end).map(l => l.trim()) });
    i = end;
  }
  return out;
}

function containsInOrder(haystack: string[], needle: string[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

describe.each([
  ['old-division-table.ts', 'useDivisionData.ts', 3],
  ['old-home-tables.ts', 'usePDLData.ts', 5],
])('%s', (copy, hook, expectedBlocks) => {
  it(`is an unchanged copy of src/hooks/${hook}`, () => {
    const blocks = copiedBlocks(join(ROOT, 'scripts', 'tools', 'capture', 'published', copy));
    expect(blocks).toHaveLength(expectedBlocks);
    const source = readFileSync(join(ROOT, 'src', 'hooks', hook), 'utf8').split(/\r?\n/).map(l => l.trim());
    for (const b of blocks) {
      expect(b.source).toBe(hook);
      expect(b.lines.length).toBeGreaterThan(3);
      expect(containsInOrder(source, b.lines), `${copy}: a block starting "${b.lines[0]}" no longer matches ${hook}`).toBe(true);
    }
  });
});

const T = 'tournaments/T';
const team = (id: string, name: string, extra: Record<string, unknown> = {}): ExportRecord =>
  ({ path: `${T}/teams/${id}`, data: { name, divisionId: 'd1', ...extra } });
const match = (id: string, a: string, b: string, sa: number, sb: number, extra: Record<string, unknown> = {}): ExportRecord =>
  ({ path: `${T}/matches/${id}`, data: { divisionId: 'd1', status: 'completed', teamA: { id: a, score: sa }, teamB: { id: b, score: sb }, ...extra } });
const division: ExportRecord = { path: `${T}/divisions/d1`, data: { name: 'elite' } };

describe('the copied standings', () => {
  // A beats B, B beats C, C beats A, all 2-0; D draws everyone. A, B, C have 2 points each from
  // their win plus 1 from the draw with D; D has 3. Head-to-head wins among A, B, C are 1 each,
  // so Neustadtl decides; with that tied too, lower total MMR wins.
  const teams = [
    team('A', 'Alpha', { totalMMR: 300 }), team('B', 'Bravo', { totalMMR: 100 }), team('C', 'Charlie', { totalMMR: 200 }), team('D', 'Delta', { totalMMR: 900 }),
    team('X', 'Elsewhere', { divisionId: 'd2' }),
  ];
  const matches = [
    match('m1', 'A', 'B', 2, 0), match('m2', 'B', 'C', 2, 0), match('m3', 'C', 'A', 2, 0),
    match('m4', 'D', 'A', 1, 1), match('m5', 'D', 'B', 1, 1), match('m6', 'D', 'C', 1, 1),
    match('m7', 'A', 'B', 2, 0, { extra: { kind: 'showmatch' } }),
    match('m8', 'C', 'D', 0, 0, { status: 'scheduled' }),
  ];

  it('orders by points, then head-to-head wins, then Neustadtl, then lower MMR', () => {
    const rows = divisionTable({ id: 'T', type: 'league' }, 'd1', teams, matches);
    expect(rows.every(r => r.points === 3 && r.neustadtlScore === 4.5)).toBe(true);
    // All four tie on 3 points; head-to-head wins: A, B, C 1 each, D 0; then Neustadtl ties;
    // then lower total MMR: B (100), C (200), A (300); D last on head-to-head.
    expect(rows.map(r => r.teamId)).toEqual(['B', 'C', 'A', 'D']);
    expect(rows.map(r => r.position)).toEqual([1, 2, 3, 4]);
  });

  it('counts the showmatch on the home page but not in the division view', () => {
    const div = divisionTable({ id: 'T', type: 'league' }, 'd1', teams, matches);
    const home = homeTables({ id: 'T', type: 'league' }, [division], teams, matches)[0];
    expect(div.find(r => r.teamId === 'A')!.wins).toBe(1);
    expect(home.teams.find(t => t.teamId === 'A')!.wins).toBe(2);
    expect(home.name).toBe('Elite');
    expect(home.teams.map(t => t.teamId)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('uses the Swiss engine for a Swiss tournament (points are games won)', () => {
    const rows = divisionTable({ id: 'T', type: 'swiss' }, 'd1', teams, [match('s1', 'A', 'B', 2, 0, { round: 1 }), match('s2', 'C', 'D', 1, 1, { round: 1 })]);
    expect(rows[0].teamId).toBe('A');
    expect(rows.find(r => r.teamId === 'C')!.points).toBe(1);
  });
});

describe('inputs rebuilt for the copies', () => {
  it('orders documents by id, as Firestore returns them, and filters like where ==', () => {
    const s = snapshot([team('b', 'B'), team('a', 'A'), team('C', 'Cap', { divisionId: 'x' })], d => d.divisionId === 'd1');
    expect(s.docs.map(d => d.id)).toEqual(['a', 'b']);
  });

  it('gives timestamps as Timestamp-like objects that compare like the client SDK', () => {
    const rec: ExportRecord = { path: `${T}/matches/m`, data: { completedAt: '2026-10-22T19:31:00.123456Z' }, types: { '/completedAt': 'timestamp' } };
    const ts = clientData(rec).completedAt as FirestoreTimestampLike;
    expect(ts).toBeInstanceOf(FirestoreTimestampLike);
    expect(ts.toDate().toISOString()).toBe('2026-10-22T19:31:00.123Z');
    expect(ts.nanoseconds).toBe(123456000);
    const earlier = FirestoreTimestampLike.fromIso('2026-10-22T19:30:59Z');
    expect(earlier.valueOf() < ts.valueOf()).toBe(true);
  });
});
