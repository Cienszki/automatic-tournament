// @vitest-environment node
// Parity of the stats hub's season numbers, the rankings page and the standings with the old
// site, for each WP-12 fixture imported into its own database (WP-33). The season numbers are
// published/stats-totals.json; the rankings are the old site's stored `performanceRankings`
// documents (`rankingsView` there), which the new compute does not read: it computes them.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament } from './index';
import type { TournamentInput } from './domain/input';
import { loadTournamentInput } from './queries';
import { asOldData, WIOSENNA_OLD } from './testing/as-old-data';
import { FIXTURES, importedDb, TOURNAMENT_ID, type FixtureSlug } from './testing/imported';
import { publishedTotals, rankingsViewOf, totalsOf, type PublishedTotals } from './testing/published';

/** Rankings by list, with the average rounded below the noise of a different summing order; optionally team names trimmed. */
function rankingLists(view: PublishedTotals['rankingsView'], trimTeams = false) {
  const name = (s: string) => (trimTeams ? s.trim() : s);
  return Object.fromEntries(view.map((l) => [l.role, {
    gameCount: l.gameCount,
    entries: l.entries.map((e) => ({ name: l.role === 'teams' ? name(e.name) : e.name, teamName: name(e.teamName), games: e.games, avgScore: Math.round(e.avgScore * 1e9) / 1e9 })),
  }]));
}

const without = <T extends { rankingsView?: unknown; method?: unknown; datasetGeneratedAt?: unknown }>(p: T) => {
  const { rankingsView, method, datasetGeneratedAt, ...rest } = p;
  void rankingsView; void method; void datasetGeneratedAt;
  return rest;
};

async function load(slug: FixtureSlug): Promise<{ t: TestDb; input: TournamentInput }> {
  const t = await importedDb([slug]);
  return { t, input: (await loadTournamentInput(TOURNAMENT_ID[slug], t.db))! };
}

describe('pdl-s2: the season numbers and the rankings, computed from the imported rows', () => {
  let t: TestDb;
  let input: TournamentInput;
  beforeAll(async () => ({ t, input } = await load('pdl-s2')), 120_000);
  afterAll(() => t.close());

  it('equal the published season numbers exactly', () => {
    expect(totalsOf(computeTournament(input))).toEqual(without(publishedTotals('pdl-s2')));
  });

  it('equal the stored rankings page, list by list', () => {
    expect(rankingLists(rankingsViewOf(computeTournament(input)))).toEqual(rankingLists(publishedTotals('pdl-s2').rankingsView));
  });
});

describe('wiosenna: the season numbers and the rankings, computed from the imported rows', () => {
  let t: TestDb;
  let input: TournamentInput;
  beforeAll(async () => ({ t, input } = await load('wiosenna')), 120_000);
  afterAll(() => t.close());

  it('equal the published season numbers except the series count and the team of the last week', () => {
    const ours = totalsOf(computeTournament(input));
    const published = without(publishedTotals('wiosenna'));
    // Ten more series: the forfeited ones the old stats left out by accident (dataset parity test).
    expect([ours.counts.matches, published.counts.matches]).toEqual([92, 82]);
    // The team of the last week ranks each player's best series; two games now belong to the playoff
    // series they were played in, not to an older group match of the same teams.
    expect(ours.overview.teamOfTheWeek).not.toEqual(published.overview.teamOfTheWeek);
    expect({ ...ours, counts: { ...ours.counts, matches: 82 }, overview: { ...ours.overview, teamOfTheWeek: published.overview.teamOfTheWeek } })
      .toEqual(published);
  });

  it('equal them exactly when the rows are changed back to the old data', () => {
    const old = asOldData(input, { movedGames: WIOSENNA_OLD.twoMatchGames, droppedMatches: WIOSENNA_OLD.forfeitedBothGames });
    expect(totalsOf(computeTournament(old))).toEqual(without(publishedTotals('wiosenna')));
  });

  it('differ from the stored rankings page only by the two games the old calculator counted twice, and a trimmed team name', () => {
    const ours = rankingsViewOf(computeTournament(input));
    const stored = publishedTotals('wiosenna').rankingsView;
    expect([ours[0].gameCount, stored[0].gameCount]).toEqual([1440, 1457]);
    // The old calculator read every match's games, so a game stored under two matches counted twice.
    const old = asOldData(input, { copiedGames: WIOSENNA_OLD.twoMatchGames });
    expect(rankingLists(rankingsViewOf(computeTournament(old)))).toEqual(rankingLists(stored, true));
    // The hub's dataset trims team names; the old calculator showed "Gramy Dla Wujka " as stored.
    const untrimmed = stored.flatMap((l) => l.entries.map((e) => e.teamName)).filter((n) => n !== n.trim());
    expect([...new Set(untrimmed)]).toEqual(['Gramy Dla Wujka ']);
  });
});

describe.each(['pdl-s2', 'wiosenna'] as const)('%s: the standings, computed from the imported rows', (slug) => {
  let t: TestDb;
  let input: TournamentInput;
  beforeAll(async () => ({ t, input } = await load(slug)), 120_000);
  afterAll(() => t.close());

  it('list every published table in its published order', () => {
    const published = JSON.parse(readFileSync(`${FIXTURES}${slug}/published/standings.json`, 'utf8')) as { tables: Array<{ groupId: string; order: string[] }> };
    const ours = computeTournament(input).standings;
    expect(ours.map((g) => g.groupId).sort()).toEqual(published.tables.map((p) => p.groupId).sort());
    for (const table of published.tables) {
      const group = ours.find((g) => g.groupId === table.groupId)!;
      expect(group.standings.rows.map((r) => r.teamId)).toEqual(table.order);
    }
  });
});
