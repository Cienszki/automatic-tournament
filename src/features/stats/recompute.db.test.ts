// @vitest-environment node
// Nothing combined is stored or updated piece by piece (WP-15): after a game is added, computing
// on a fresh load equals computing on the old rows plus the new ones in memory. (That no table
// holds a combined number is checked in schema-guard.db.test.ts.)

import { eq, isNull, ne } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { games, matches, performances, scoped, teamMembers } from '@/platform/db';
import type { TestDb } from '@/platform/db/testing';
import { computeTournament, type TournamentStats } from './domain/compute';
import type { InputGame, InputPerformance, TournamentInput } from './domain/input';
import { loadTournamentInput } from './queries';
import { importedDb, TOURNAMENT_ID } from './testing/imported';

const ID = TOURNAMENT_ID['pdl-s2'];
const GAME_ID = '9100000001';
const STARTED = new Date('2026-11-20T19:00:00.000Z');

/** Everything computeTournament returns that is plain data, without the time of the load. */
const plain = (s: TournamentStats) => ({ ...s.dataset, generatedAt: '', season: s.season, standings: s.standings, rankings: s.rankings });

const stat = (i: number) => ({
  kills: 3 + i, deaths: 2, assists: 7, lastHits: 120 + i, denies: 4, gpm: 450 + i, xpm: 520, netWorth: 15000, totalGold: 18000,
  goldSpent: 17000, heroDamage: 21000, towerDamage: 2000, heroHealing: 0, obsPlaced: 3, senPlaced: 2, observerKills: 1, sentryKills: 0,
  courierKills: 0, roshanKills: 0, towerKills: 1, neutralKills: 20, laneKills: 100, campsStacked: 1, runesPickedUp: 4, buybacks: 0,
  firstBlood: i === 0, highestKillStreak: 3, doubleKills: 1, tripleKills: 0, ultraKills: 0, rampages: 0,
});

let t: TestDb;
let before: TournamentInput;
let added: { matchId: string; game: InputGame; perfs: InputPerformance[]; teamA: string; teamB: string };

beforeAll(async () => {
  t = await importedDb(['pdl-s2']);
  before = (await loadTournamentInput(ID, t.db))!;
  const match = before.matches.find((m) => m.status === 'scheduled' && m.teamAId && m.teamBId)!;
  const roster = await scoped(t.db, ID).select({ teamId: teamMembers.teamId, steamId64: teamMembers.steamId64 })
    .from(teamMembers, isNull(teamMembers.leftAt), ne(teamMembers.kind, 'coach'));
  const side = (teamId: string) => roster.filter((r) => r.teamId === teamId).slice(0, 5);
  const players = [...side(match.teamAId!), ...side(match.teamBId!)];
  const game: InputGame = {
    id: GAME_ID, matchId: match.id, number: 1, radiantTeamId: match.teamAId, direTeamId: match.teamBId, radiantWin: true,
    isForfeit: false, startedAt: STARTED, durationSeconds: 2400, firstBloodSeconds: 95, picksBans: [],
  };
  const perfs: InputPerformance[] = players.map((p, i) => ({ gameId: GAME_ID, steamId64: p.steamId64!, teamId: p.teamId, heroId: 10 + i, ...stat(i) }));
  added = { matchId: match.id, game, perfs, teamA: match.teamAId!, teamB: match.teamBId! };

  const s = scoped(t.db, ID);
  await s.insert(games, { ...game, dotaMatchId: Number(GAME_ID), source: 'manual', parsed: true });
  await s.insert(performances, perfs);
  await s.update(matches, { status: 'completed', scoreA: 1, scoreB: 0, winnerTeamId: match.teamAId, completedAt: new Date(STARTED.getTime() + 2400e3) }, eq(matches.id, match.id));
}, 120_000);
afterAll(() => t.close());

describe('computing after a game is added', () => {
  it('equals computing on the old rows with the new ones added in memory', async () => {
    const fresh = computeTournament((await loadTournamentInput(ID, t.db))!);
    const inMemory: TournamentInput = {
      ...before,
      matches: before.matches.map((m) => (m.id === added.matchId
        ? { ...m, status: 'completed' as const, scoreA: 1, scoreB: 0, winnerTeamId: added.teamA, completedAt: new Date(STARTED.getTime() + 2400e3) }
        : m)),
      games: [...before.games, added.game],
      performances: [...before.performances, ...added.perfs],
    };
    expect(plain(computeTournament(inMemory))).toEqual(plain(fresh));
  });

  it('changes the season numbers, the standings and the rankings for every number the game touches', async () => {
    const old = computeTournament(before);
    const fresh = computeTournament((await loadTournamentInput(ID, t.db))!);
    expect(fresh.season.counts.games).toBe(old.season.counts.games + 1);
    expect(fresh.season.counts.matches).toBe(old.season.counts.matches + 1);
    expect(fresh.season.totals.kills).toBe(old.season.totals.kills + added.perfs.reduce((n, p) => n + p.kills, 0));
    const played = (s: TournamentStats, team: string) => s.standings[0].standings.rows.find((r) => r.teamId === team)!.record.played;
    expect(played(fresh, added.teamA)).toBe(played(old, added.teamA) + 1);
    expect(fresh.rankings.gameCount).toBeGreaterThan(old.rankings.gameCount);
  });

  it('keeps no state between calls: the old rows give the old numbers again', () => {
    const first = plain(computeTournament(before));
    computeTournament({ ...before, games: [...before.games, added.game], performances: [...before.performances, ...added.perfs] });
    expect(plain(computeTournament(before))).toEqual(first);
  });
});
