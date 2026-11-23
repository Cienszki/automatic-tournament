// @vitest-environment node
// Parity of the stats hub's dataset with the old site: each WP-12 fixture is imported into its
// own database (WP-33), loaded, and computed; the result is compared with the payload the live
// site served (published/stats-dataset.json). Every difference is listed here with its cause.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament } from './index';
import type { StatsDataset } from './domain/types';
import { loadTournamentInput } from './queries';
import { datasetDifferences, differenceKinds } from './testing/dataset-diff';
import { importedDb, TOURNAMENT_ID, type FixtureSlug } from './testing/imported';
import { publishedDataset } from './testing/published';

/**
 * Differences that are expected, by kind, with how many lines of each.
 * - `perf *.fantasyPoints`: the old payload carried a stored fantasy calculation; the import does
 *   not keep it (SCHEMA.md 7.5) and fantasy scoring is WP-16, so the column is 0. The hub reads it
 *   only to pick a game's MVP when no performance in the game has a score.
 * - `match *.round` (Wiosenna): its match documents have no round. `matches.round` is required:
 *   the import writes 1 for a group match and the bracket round for a playoff match. The hub
 *   reads the round only for leagues and Swiss.
 * - `match *: only in ours` (Wiosenna): ten series lost 0:2 by forfeiting both games. The old
 *   builder dropped them by accident: forfeited games share the id `forfeit_game1` in every
 *   match, so its de-duplication of games took them for copies (one such series, the first by
 *   id, survived). They count now, like every other completed series.
 * - `match *.completedAt` (Wiosenna bracket): the import takes the bracket document's result
 *   time (`playoff_matches.result.completedAt`, rewritten for the whole bracket on 2026-07-25)
 *   over the mirror match's own time, which the old payload used (finding for WP-33).
 * - `game *.matchId` (Wiosenna): two Dota games were stored under a group match and under the
 *   playoff match of the same teams. The old builder kept them under the group match; the import
 *   keeps them under the playoff match whose best of three they complete (WP-33).
 * - `player *.name` (Wiosenna): a stand-in with two approved requests under two nicknames. The
 *   later one ("sylwek") belongs to a match that is not in the tournament, so the import leaves
 *   that request out and the earlier nickname remains.
 */
const EXPECTED: Record<FixtureSlug, Record<string, number>> = {
  'pdl-s2': { 'perf *.fantasyPoints': 240 },
  wiosenna: {
    'perf *.fantasyPoints': 1630,
    'match *.round': 82,
    'match *: only in ours': 10,
    'match *.completedAt': 11,
    'game *.matchId': 2,
    'player *.name': 1,
  },
};

const WIOSENNA_LINES = [
  'match Id81mNPOvSmIK4SSE6Ge: only in ours', 'match JZp7D6M2wsdVpnKRXBlJ: only in ours',
  'match MbUrCcg2LDJQnPJV7WIR: only in ours', 'match ODtefs8S6qJZQENm4FfI: only in ours',
  'match UOW07MKlM70RaTR3ro2e: only in ours', 'match ayOWKqs3kiAMAeIn4bTq: only in ours',
  'match dQ3zX7yMz4GJ6yKmXytX: only in ours', 'match hAgLxarejlI3cnB6bY7F: only in ours',
  'match pSbcGrKODPeag6yiHjyw: only in ours', 'match qaWx4R8xlXo8wyNop43G: only in ours',
  'game 8904592446.matchId: ours "ub-r2-p2", published "cxozIoYGO0ViB55POI36"',
  'game 8910469903.matchId: ours "ub-r3-p1", published "HVwwRd87bSFsCzkph25p"',
  'player 76561198117411098.name: ours "Icarus Drive", published "sylwek"',
];

describe.each(['pdl-s2', 'wiosenna'] as const)('the dataset of %s, imported and computed', (slug) => {
  let t: TestDb;
  let ours: StatsDataset;
  beforeAll(async () => {
    t = await importedDb([slug]);
    ours = computeTournament((await loadTournamentInput(t.db, TOURNAMENT_ID[slug]))!).dataset;
  }, 120_000);
  afterAll(() => t.close());

  it('differs from the published payload only where expected', () => {
    expect(differenceKinds(datasetDifferences(ours, publishedDataset(slug)))).toEqual(EXPECTED[slug]);
  });

  it('has every team, group, player, game and performance of the published payload', () => {
    const published = publishedDataset(slug);
    for (const kind of ['teams', 'groups', 'players', 'games', 'perfs'] as const) {
      expect({ kind, n: (ours[kind] ?? []).length }).toEqual({ kind, n: (published[kind] ?? []).length });
    }
  });

  if (slug === 'wiosenna') {
    it('names each one-off difference', () => {
      const lines = datasetDifferences(ours, publishedDataset(slug));
      const oneOff = lines.filter((l) => / only in ours$|\.matchId:|\.name:/.test(l));
      expect(oneOff.sort()).toEqual([...WIOSENNA_LINES].sort());
      for (const l of lines.filter((x) => x.includes('.round:'))) expect(l).toMatch(/^match (ub|lb)-.*: ours [1-9], published none$|: ours 1, published none$/);
      for (const l of lines.filter((x) => x.includes('.completedAt:'))) expect(l).toMatch(/^match (ub|lb)-/);
    });
  }
});
