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
 * - `match *.completedAt` (Wiosenna bracket): not a repair, an import defect. The import takes
 *   the bracket document's result time (`playoff_matches.result.completedAt`), which was
 *   rewritten for the whole bracket on 2026-07-25 at 17:46, over the mirror match's real finish
 *   time, which the old payload used (`ub-r1-p1` really finished on 2026-07-12 at 21:43). The
 *   new values are wrong; the WP-33 follow-up is recorded on overhaul. The hub's season numbers do
 *   not read this time.
 * - `player *.avatar`: where a roster document had no picture, the old builder fell back to the
 *   team's roster map and took its small picture (`avatar`), never the map's `avatarmedium`.
 *   The import puts the map's values on the player, so the medium picture the old builder
 *   preferred (`avatarmedium`, then `avatarfull`, then `avatar`) is now there and used: the
 *   same Steam picture at 64 instead of 32 pixels.
 * - `game *.matchId` (Wiosenna): two Dota games were stored under a group match and under the
 *   playoff match of the same teams. The old builder kept them under the group match; the import
 *   keeps them under the playoff match whose best of three they complete (WP-33).
 * - `player *.name` (Wiosenna): a stand-in with two approved requests under two nicknames. The
 *   later one ("sylwek") belongs to a match that is not in the tournament, so the import leaves
 *   that request out and the earlier nickname remains.
 */
const EXPECTED: Record<FixtureSlug, Record<string, number>> = {
  'pdl-s2': { 'perf *.fantasyPoints': 240, 'player *.avatar': 54 },
  wiosenna: {
    'perf *.fantasyPoints': 1630,
    'match *.round': 82,
    'match *: only in ours': 10,
    'match *.completedAt': 11,
    'game *.matchId': 2,
    'player *.name': 1,
    'player *.avatar': 45,
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
    ours = computeTournament((await loadTournamentInput(TOURNAMENT_ID[slug], t.db))!).dataset;
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

  it('shows the same Steam picture, only the medium size of it', () => {
    const lines = datasetDifferences(ours, publishedDataset(slug)).filter((l) => l.includes('.avatar:'));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const [, mine, theirs] = /: ours "(.+)_medium\.jpg", published "(.+)\.jpg"$/.exec(l) ?? [];
      expect({ l, same: !!mine && mine === theirs }).toEqual({ l, same: true });
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
