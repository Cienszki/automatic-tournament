// @vitest-environment node
// The import against a real database (PGlite with every migration): the fixtures go in, a
// second run changes nothing, a change in the source changes only its rows, rows the source no
// longer has are reported and deleted only with prune, and the standings computed from the
// imported rows are the old site's published tables.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { totalChanges } from '../report';
import { runImport, type RunOptions } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const FIXTURES = [join(ROOT, 'fixtures', 'exports', 'pdl-s2'), join(ROOT, 'fixtures', 'exports', 'wiosenna'), join(ROOT, 'fixtures', 'import', 'letnia')];
const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: [join(ROOT, 'fixtures', 'exports')] };

let t: TestDb;
let first: Awaited<ReturnType<typeof runImport>>;
beforeAll(async () => {
  t = await createTestDb();
  first = await runImport(t.db, FIXTURES, OPTIONS);
}, 120_000);
afterAll(() => t.close());

describe('importing the fixtures', () => {
  it('writes every mapped row, and the database holds exactly those rows', () => {
    expect(totalChanges(first)).toBeGreaterThan(1000);
    for (const tr of first.tournaments) {
      for (const c of tr.counts) if (c.inDatabase !== null) expect({ table: c.table, n: c.inDatabase }).toEqual({ table: c.table, n: c.mapped });
    }
  });

  it('puts Letnia in the same tables as the others', async () => {
    const tournaments = await t.db.select({ id: s.tournaments.id, slug: s.tournaments.slug }).from(s.tournaments);
    expect(tournaments.map((x) => x.slug).sort()).toEqual(['letnia', 'pdl-s2', 'wiosenna']);
    expect(tournaments.find((x) => x.slug === 'letnia')!.id).toBe('letnia');
    for (const table of [s.teams, s.matches, s.games, s.performances]) {
      const rows = await t.db.select({ tid: table.tournamentId }).from(table).where(eq(table.tournamentId, 'letnia'));
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it('computes the published standings of every table that has one', () => {
    const compared = first.tournaments.flatMap((tr) => tr.standings.filter((x) => x.against === 'published'));
    expect(compared.map((x) => x.groupName).sort()).toEqual(['Grupa A', 'Grupa B', 'Swiss']);
    for (const c of compared) expect({ group: c.groupName, differences: c.differences }).toEqual({ group: c.groupName, differences: [] });
  });

  it('compares Letnia with its stored standings and explains the differences', () => {
    const letnia = first.tournaments.find((tr) => tr.mapped.capture.slug === 'letnia')!;
    expect(letnia.standings).toHaveLength(6);
    for (const c of letnia.standings.filter((x) => x.differences.length)) expect(c.explanation).toMatch(/not updated/);
  });
});

describe('running again', () => {
  it('changes nothing', async () => {
    const again = await runImport(t.db, FIXTURES, OPTIONS);
    expect(totalChanges(again)).toBe(0);
    expect(again.tournaments.flatMap((tr) => tr.writes).every((w) => w.stale === 0)).toBe(true);
  });

  it('changes only the rows whose source changed, and reports rows the source lost', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'import-change-'));
    try {
      const copy = join(dir, 'pdl-s2');
      cpSync(FIXTURES[0], copy, { recursive: true });
      const teamsFile = join(copy, 'teams.jsonl');
      const lines = readFileSync(teamsFile, 'utf8').trim().split('\n');
      const team = JSON.parse(lines[0]) as { path: string; data: Record<string, unknown> };
      team.data.name = 'Nowa nazwa';
      lines[0] = JSON.stringify(team);
      writeFileSync(teamsFile, `${lines.join('\n')}\n`);
      const scrims = join(copy, 'scrimSlots.jsonl');
      writeFileSync(scrims, '');
      const manifestFile = join(copy, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
      manifest.collections.scrimSlots.documents = 0;
      // --prune needs a complete capture: this one stands for the owner's export, refused nothing.
      for (const entry of Object.values(manifest.collections) as Array<{ status: string }>) entry.status = 'ok';
      writeFileSync(manifestFile, JSON.stringify(manifest));

      const changed = await runImport(t.db, [copy], OPTIONS);
      const writes = changed.tournaments[0].writes;
      expect(writes.find((w) => w.table === 'app.teams')).toMatchObject({ inserted: 0, updated: 1 });
      expect(writes.find((w) => w.table === 'app.scrim_slots')).toMatchObject({ stale: 1, deleted: 0 });
      expect(totalChanges(changed)).toBe(1);

      const pruned = await runImport(t.db, [copy], { ...OPTIONS, prune: true });
      expect(pruned.tournaments[0].writes.find((w) => w.table === 'app.scrim_slots')).toMatchObject({ stale: 1, deleted: 1 });
      const [row] = await t.db.select({ name: s.teams.name }).from(s.teams).where(eq(s.teams.id, team.path.split('/').pop()!));
      expect(row.name).toBe('Nowa nazwa');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
