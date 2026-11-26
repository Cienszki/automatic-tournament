// The dataset's rules, on hand-made rows: which series and games count, and who the players are.

import { describe, expect, it } from 'vitest';
import type { InputGame, InputMatch, InputMember, InputPerformance, TournamentInput } from '../input';
import { buildDataset } from './build-dataset';

const at = (day: number) => new Date(Date.UTC(2026, 5, day, 18));

const match = (id: string, over: Partial<InputMatch> = {}): InputMatch => ({
  id, stageId: 'groups', groupId: 'A', round: 1, matchday: null, kind: 'regular', replacesMatchId: null, teamAId: 'red',
  teamBId: 'blue', status: 'completed', scoreA: 1, scoreB: 0, winnerTeamId: 'red', completedAt: at(1), scheduledAt: null,
  forfeitTeamId: null, forfeitScope: null, code: null, ...over,
});

const game = (id: string, matchId: string, day: number, over: Partial<InputGame> = {}): InputGame => ({
  id, matchId, number: 1, radiantTeamId: 'red', direTeamId: 'blue', radiantWin: true, isForfeit: false, startedAt: at(day),
  durationSeconds: 2000, firstBloodSeconds: 60, picksBans: [{ heroId: 5, isPick: false, order: 0, team: 1 }], ...over,
});

const perf = (gameId: string, steamId64: string, teamId: string, over: Partial<InputPerformance> = {}): InputPerformance => ({
  gameId, steamId64, teamId, heroId: 1, kills: 1, deaths: 1, assists: 1, lastHits: 1, denies: 0, gpm: 400, xpm: 400, netWorth: 1,
  totalGold: 1, goldSpent: 1, heroDamage: 1, towerDamage: 1, heroHealing: 0, obsPlaced: 0, senPlaced: 0, observerKills: 0,
  sentryKills: 0, courierKills: 0, roshanKills: 0, towerKills: 0, neutralKills: 0, laneKills: 0, campsStacked: 0, runesPickedUp: 0,
  buybacks: 0, firstBlood: false, highestKillStreak: 0, doubleKills: 0, tripleKills: 0, ultraKills: 0, rampages: 0, ...over,
});

const member = (id: string, teamId: string, over: Partial<InputMember> = {}): InputMember => ({
  id, teamId, steamId64: id, kind: 'player', position: 'mid', nickname: `nick-${id}`, mmr: 5000, joinedAt: at(1), leftAt: null,
  avatarUrl: null, ...over,
});

function input(over: Partial<TournamentInput> = {}): TournamentInput {
  return {
    tournament: { id: 't1', formatPreset: 'league', status: 'active' }, loadedAt: new Date('2026-11-23T10:00:00Z'),
    stages: [{ id: 'groups', position: 1, kind: 'round_robin', name: 'Grupy', ranking: null }, { id: 'po', position: 2, kind: 'bracket', name: 'Playoffy', ranking: null }],
    groups: [{ id: 'A', stageId: 'groups', name: 'Grupa A', position: 1, tier: null }],
    groupTeams: [],
    teams: [
      { id: 'red', name: ' Red ', tag: 'R', logoUrl: null, status: 'verified' },
      { id: 'blue', name: 'Blue', tag: null, logoUrl: null, status: 'banned' },
    ],
    members: [], standins: [], matches: [], games: [], performances: [], ...over,
  };
}

describe('buildDataset: which series count', () => {
  const ds = buildDataset(input({
    matches: [
      match('played'),
      match('walkover', { scoreA: 2, scoreB: 0, completedAt: at(2) }),
      match('ban', { forfeitTeamId: 'blue', forfeitScope: 'series', scoreA: 2, scoreB: 0, completedAt: at(3) }),
      match('original', { completedAt: at(4) }),
      match('rematch', { kind: 'rematch', replacesMatchId: 'original', completedAt: at(5) }),
      match('bye', { status: 'bye', teamBId: null }),
      match('later', { status: 'scheduled', scoreA: null, scoreB: null }),
      match('final', { stageId: 'po', groupId: null, code: 'GF', completedAt: at(6) }),
    ],
    games: [game('g1', 'played', 1), game('walkover-forfeit-1', 'walkover', 2, { isForfeit: true, radiantWin: null })],
  }));

  it('counts every completed series but a ban walkover, a replayed original and a bye, in order of completion', () => {
    expect(ds.matches.map((m) => m.id)).toEqual(['played', 'walkover', 'rematch', 'final']);
  });

  it('marks a bracket series as a playoff with its code', () => {
    expect(ds.matches.find((m) => m.id === 'final')).toMatchObject({ isPlayoff: true, playoffCode: 'GF' });
    expect(ds.matches[0]).toEqual({ id: 'played', groupId: 'A', teamA: 'red', teamB: 'blue', scoreA: 1, scoreB: 0, winnerId: 'red', round: 1, completedAt: at(1).getTime() });
  });

  it('leaves forfeited games out', () => {
    expect(ds.games.map((g) => g.id)).toEqual(['g1']);
    expect(ds.games[0]).toEqual({ id: 'g1', matchId: 'played', radiant: 'red', dire: 'blue', radiantWin: true, duration: 2000, start: at(1).getTime() / 1000, firstBlood: 60, pb: [[5, 0, 1, 0]] });
  });

  it('keeps a series given against a now-banned team when its games were played', () => {
    const decided = buildDataset(input({
      matches: [match('decided', { forfeitTeamId: 'blue', forfeitScope: 'series', scoreA: 2, scoreB: 0 })],
      games: [game('d1', 'decided', 1), game('d2', 'decided', 1, { radiantWin: false })],
    }));
    expect(decided.matches.map((m) => m.id)).toEqual(['decided']);
    expect(decided.games.map((g) => g.id)).toEqual(['d1', 'd2']);
  });

  it('trims team names and keeps every team', () => {
    expect(ds.teams).toEqual([{ id: 'blue', name: 'Blue' }, { id: 'red', name: 'Red', tag: 'R' }]);
    expect(ds.generatedAt).toBe('2026-11-23T10:00:00.000Z');
  });
});

describe('buildDataset: performances and players', () => {
  const ds = buildDataset(input({
    matches: [match('m1')],
    games: [game('late', 'm1', 3), game('early', 'm1', 2)],
    members: [
      member('111', 'blue', { leftAt: at(2), position: 'carry' }),
      member('111', 'red', { id: 'r-111', avatarUrl: 'https://a/1.jpg' }),
      member('coach', 'red', { kind: 'coach' }),
    ],
    standins: [{ steamId64: '222', nickname: 'pierwszy' }, { steamId64: '222', nickname: 'drugi' }, { steamId64: '111', nickname: 'nie' }],
    performances: [perf('late', '111', 'red', { firstBlood: true }), perf('early', '222', 'red'), perf('early', '111', 'red'), perf('late', '333', 'blue')],
  }));

  it('orders games by start and performances by game, then player', () => {
    expect(ds.games.map((g) => g.id)).toEqual(['early', 'late']);
    expect(ds.perfs.map((r) => [r[0], r[1]])).toEqual([[0, '111'], [0, '222'], [1, '111'], [1, '333']]);
    expect(ds.perfs[2][3 + 17]).toBe(1); // firstBloodClaimed
    expect(ds.perfs[2][3 + 20]).toBe(0); // fantasyPoints: not computed here (WP-16)
  });

  it('names players from the current roster, stand-ins by their last approved name, and no one else', () => {
    const byId = Object.fromEntries(ds.players.map((p) => [p.id, p]));
    expect(byId['111']).toEqual({ id: '111', name: 'nick-111', teamId: 'red', role: 'Mid', avatar: 'https://a/1.jpg' });
    expect(byId['222']).toEqual({ id: '222', name: 'drugi', standin: true });
    expect(Object.keys(byId).sort()).toEqual(['111', '222']);
  });
});
