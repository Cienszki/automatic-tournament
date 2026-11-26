// @vitest-environment node
// The import over the four full captures (WP-12's data-exports/, git-ignored): every owner
// correction matches its row, the findings the owner answered are gone, and a second run writes
// nothing. Skipped where the captures are not on disk (CI); the fixture tests cover the same
// corrections on smaller data (corrections.test.ts, mappers.test.ts, pdl-corrections.db.test.ts).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { OWNER_CORRECTIONS } from '../corrections';
import { totalChanges } from '../report';
import { runImport, type RunOptions, type RunResult } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const EXPORTS = [process.env.IMPORT_DATA_EXPORTS, join(ROOT, 'data-exports'), join(ROOT, '..', 'overhaul', 'data-exports')]
  .find((d): d is string => !!d && existsSync(join(d, 'pdl', 'manifest.json')));
const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: EXPORTS ? [join(EXPORTS, 'published'), join(ROOT, 'fixtures', 'exports')] : [] };

describe.skipIf(!EXPORTS)('the import of the four full captures', () => {
  let t: TestDb;
  let first: RunResult;
  beforeAll(async () => {
    t = await createTestDb();
    first = await runImport(t.db, [EXPORTS!], OPTIONS);
  }, 300_000);
  afterAll(() => t.close());

  it('applies every owner correction to a row', () => {
    const outcomes = first.tournaments.flatMap((tr) => tr.mapped.state.corrections.finish());
    expect(outcomes.filter((o) => o.status !== 'applied')).toEqual([]);
    expect(new Set(outcomes.map((o) => o.id))).toEqual(new Set(OWNER_CORRECTIONS.map((c) => c.id)));
  });

  it('leaves none of the findings the owner answered', () => {
    const answered = /stored score disagrees|steamId and steamId64 differ|owner correction matched no row/;
    expect(first.tournaments.flatMap((tr) => tr.mapped.ctx.findings).filter((f) => answered.test(f.reason))).toEqual([]);
    const letnia = first.tournaments.find((tr) => tr.mapped.capture.slug === 'letnia')!;
    expect(letnia.mapped.ctx.findings.filter((f) => f.reason.startsWith('the match has more games than its series length'))).toEqual([]);
  });

  it('matches every published table, apart from the values the owner\'s corrections change', () => {
    const published = first.tournaments.flatMap((tr) => tr.standings.filter((x) => x.against === 'published'));
    for (const c of published) expect({ group: c.groupName, differences: c.differences }).toEqual({ group: c.groupName, differences: [] });
    expect(published.filter((c) => c.corrected.length).map((c) => c.groupName).sort()).toEqual(['Elite', 'Grupa B']);
  });

  it('writes nothing the second time', async () => {
    expect(totalChanges(await runImport(t.db, [EXPORTS!], OPTIONS))).toBe(0);
  }, 300_000);
});
