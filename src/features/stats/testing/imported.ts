// Test helper: a fresh PGlite database with WP-12 fixtures imported by the import tool (WP-33),
// the way a tournament reaches the new platform. Only tests use it.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { runImport } from '../../../../scripts/import/run';

export const FIXTURES = fileURLToPath(new URL('../../../../fixtures/exports/', import.meta.url));

/** The tournament id of each fixture (its manifest's `tournamentId`). */
export const TOURNAMENT_ID = { 'pdl-s2': 'iqsu1EY1Bj7zAeRYjTkj', wiosenna: 't2LLkrQbj0pwKm9i4nUs' } as const;
export type FixtureSlug = keyof typeof TOURNAMENT_ID;

/** A test database holding the given fixtures, imported. */
export async function importedDb(slugs: readonly FixtureSlug[]): Promise<TestDb> {
  const t = await createTestDb();
  await runImport(t.db, slugs.map((s) => join(FIXTURES, s)), { anonymize: false, prune: false, publishedDirs: [FIXTURES] });
  return t;
}
