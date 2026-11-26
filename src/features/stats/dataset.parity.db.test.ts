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
 * - `match *.scoreB` and `match *.winnerId` (Wiosenna): repairs, the owner's corrections
 *   (STATUS.md question 43, scripts/import/owner-corrections.json). The old payload carried the
 *   stored scores, which counted a playoff game that was also stored under a group match, and a
 *   game that was never played: Grupa B, 24 June 2026, Chrupek zamknij się vs Adaś, ile za tę
 *   Robotę? is a 1:1 draw (was 1:2 for Adaś, so its winner goes too); Grupa B, 30 June 2026,
 *   Puck It! vs Adaś is 2:0 (was 2:1); upper bracket round 1 (U1C), 14 July 2026, Adaś vs Dwa
 *   Razy I Do Bazy is 2:0 (was 2:1).
 * - `match *.completedAt` (Wiosenna grand final only; WP-33b). The bracket's result times of the
 *   ten earlier bracket matches were rewritten on 2026-07-25 at 17:46; the import recognizes that
 *   bulk rewrite and takes the mirror's earlier time, as the old payload did, so those ten agree.
 *   The final's bracket time (26 July 16:53:48.118) shares its timestamp only with the byes, which
 *   do not count as a rewrite, so the import keeps it; the old payload used the mirror's, 0.8
 *   seconds earlier. Both are after the final's last game ended (16:31).
 * - `player *.avatar`: where a roster document had no picture, the old builder fell back to the
 *   team's roster map and took its small picture (`avatar`), never the map's `avatarmedium`.
 *   The import puts the map's values on the player, so the medium picture the old builder
 *   preferred (`avatarmedium`, then `avatarfull`, then `avatar`) is now there and used: the
 *   same Steam picture at 64 instead of 32 pixels.
 * - `game *.matchId` (Wiosenna): two Dota games were stored under a group match and under the
 *   playoff match of the same teams. The old builder kept them under the group match; the import
 *   keeps them under the playoff match they were played in, on the owner's word and by date
 *   (WP-33b).
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
    'match *.scoreB': 3,
    'match *.winnerId': 1,
    'match *.completedAt': 1,
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
  'match HVwwRd87bSFsCzkph25p.scoreB: ours 1, published 2',
  'match HVwwRd87bSFsCzkph25p.winnerId: ours null, published "u6kMrDWsUi2WF6GKhWH5"',
  'match cxozIoYGO0ViB55POI36.scoreB: ours 0, published 1',
  'match ub-r1-p3.scoreB: ours 0, published 1',
  'match ub-r4-p1.completedAt: ours 1785084828118, published 1785084827299',
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
      const oneOff = lines.filter((l) => / only in ours$|\.matchId:|\.name:|\.scoreB:|\.winnerId:|\.completedAt:/.test(l));
      expect(oneOff.sort()).toEqual([...WIOSENNA_LINES].sort());
      for (const l of lines.filter((x) => x.includes('.round:'))) expect(l).toMatch(/^match (ub|lb)-.*: ours [1-9], published none$|: ours 1, published none$/);
    });
  }
});
