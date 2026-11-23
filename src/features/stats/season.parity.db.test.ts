// @vitest-environment node
// Parity of the stats hub's season numbers, the rankings page and the standings with the old
// site, for each WP-12 fixture imported once into its own database (WP-33). The season numbers
// are published/stats-totals.json; the rankings are the old site's stored `performanceRankings`
// documents (performanceRankings.jsonl), which the new compute does not read: it computes them.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament } from './index';
import type { TournamentInput } from './domain/input';
import { loadTournamentInput } from './queries';
import { asOldData, WIOSENNA_OLD } from './testing/as-old-data';
import { FIXTURES, importedDb, TOURNAMENT_ID, type FixtureSlug } from './testing/imported';
import { publishedTotals, rankingsViewOf, storedRankings, totalsOf, type RankingList } from './testing/published';

const SLUGS = ['pdl-s2', 'wiosenna'] as const;
const db: Partial<Record<FixtureSlug, TestDb>> = {};
const inputs: Partial<Record<FixtureSlug, TournamentInput>> = {};
beforeAll(async () => {
  for (const slug of SLUGS) {
    db[slug] = await importedDb([slug]);
    inputs[slug] = (await loadTournamentInput(TOURNAMENT_ID[slug], db[slug]!.db))!;
  }
}, 120_000);
afterAll(async () => { for (const slug of SLUGS) await db[slug]?.close(); });
const input = (slug: FixtureSlug) => inputs[slug]!;

const round9 = (v: unknown) => (typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v);

/**
 * Rankings by list, every field the page draws (name, team, games, average and the nine part
 * averages), numbers rounded below the noise of a different summing order; optionally the team
 * names trimmed.
 */
function rankingLists(view: RankingList[], trimTeams = false) {
  const name = (s: string) => (trimTeams ? s.trim() : s);
  return Object.fromEntries(view.map((l) => [l.role, {
    gameCount: l.gameCount,
    entries: l.entries.map((e) => Object.fromEntries(Object.entries({
      ...e, name: l.role === 'teams' ? name(e.name) : e.name, teamName: name(e.teamName),
    }).map(([k, v]) => [k, round9(v)]))),
  }]));
}

const without = <T extends { rankingsView?: unknown; method?: unknown; datasetGeneratedAt?: unknown }>(p: T) => {
  const { rankingsView, method, datasetGeneratedAt, ...rest } = p;
  void rankingsView; void method; void datasetGeneratedAt;
  return rest;
};

describe('pdl-s2: the season numbers and the rankings, computed from the imported rows', () => {
  it('equal the published season numbers exactly', () => {
    expect(totalsOf(computeTournament(input('pdl-s2')))).toEqual(without(publishedTotals('pdl-s2')));
  });

  it('equal the stored rankings page, list by list and part by part', () => {
    const stored = storedRankings('pdl-s2');
    expect(stored.find((l) => l.role === 'carry')!.entries[0].killPts).toBeDefined();
    expect(rankingLists(rankingsViewOf(computeTournament(input('pdl-s2'))))).toEqual(rankingLists(stored));
  });
});

describe('wiosenna: the season numbers and the rankings, computed from the imported rows', () => {
  it('equal the published season numbers except the series count and the team of the last week', () => {
    const ours = totalsOf(computeTournament(input('wiosenna')));
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
    const old = asOldData(input('wiosenna'), { movedGames: WIOSENNA_OLD.twoMatchGames, droppedMatches: WIOSENNA_OLD.forfeitedBothGames });
    expect(totalsOf(computeTournament(old))).toEqual(without(publishedTotals('wiosenna')));
  });

  it('differ from the stored rankings page only by the two games the old calculator counted twice, and a trimmed team name', () => {
    const ours = rankingsViewOf(computeTournament(input('wiosenna')));
    const stored = storedRankings('wiosenna');
    expect([ours[0].gameCount, stored[0].gameCount]).toEqual([1440, 1457]);
    // The old calculator read every match's games, so a game stored under two matches counted twice.
    const old = asOldData(input('wiosenna'), { copiedGames: WIOSENNA_OLD.twoMatchGames });
    expect(rankingLists(rankingsViewOf(computeTournament(old)))).toEqual(rankingLists(stored, true));
    // The hub's dataset trims team names; the old calculator showed "Gramy Dla Wujka " as stored.
    const untrimmed = stored.flatMap((l) => l.entries.map((e) => e.teamName)).filter((n) => n !== n.trim());
    expect([...new Set(untrimmed)]).toEqual(['Gramy Dla Wujka ']);
  });
});

describe.each(SLUGS)('%s: the standings, computed from the imported rows', (slug) => {
  it('list every published table in its published order', () => {
    const published = JSON.parse(readFileSync(`${FIXTURES}${slug}/published/standings.json`, 'utf8')) as { tables: Array<{ groupId: string; order: string[] }> };
    const ours = computeTournament(input(slug)).standings;
    expect(ours.map((g) => g.groupId).sort()).toEqual(published.tables.map((p) => p.groupId).sort());
    for (const table of published.tables) {
      const group = ours.find((g) => g.groupId === table.groupId)!;
      expect(group.standings.rows.map((r) => r.teamId)).toEqual(table.order);
    }
  });
});
