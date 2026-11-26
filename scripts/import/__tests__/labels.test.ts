// Readable names of matches and games (labels.ts), from mapped rows.

import { describe, expect, it } from 'vitest';
import * as s from '@/platform/db/schema';
import { MatchLabels, subjectOf } from '../labels';
import { RowSet } from '../rows';

const t = 'w';
function rows(): RowSet {
  const r = new RowSet();
  r.add(s.tournaments, { id: t, name: 'Wiosenna Furia' });
  r.add(s.stages, [{ tournamentId: t, id: 'groups', kind: 'round_robin', name: 'Faza grupowa' }, { tournamentId: t, id: 'playoffs', kind: 'bracket', name: 'Playoffy' },
    { tournamentId: t, id: 'swiss', kind: 'swiss', name: 'Swiss' }]);
  r.add(s.groups, { tournamentId: t, id: 'g-b', name: 'Grupa B' });
  r.add(s.teams, [{ tournamentId: t, id: 'chrupek', name: 'Chrupek zamknij się' }, { tournamentId: t, id: 'adas', name: 'Adaś, ile za tę Robotę? ' }]);
  const base = { tournamentId: t, teamAId: 'chrupek', teamBId: 'adas', status: 'completed', matchday: null, bracketSide: null, code: null, round: 1 };
  r.add(s.matches, [
    { ...base, id: 'HVwwRd87bSFsCzkph25p', stageId: 'groups', groupId: 'g-b', scoreA: 1, scoreB: 1, scheduledAt: new Date('2026-06-24T17:30:00Z') },
    { ...base, id: 'ub-r3-p1', stageId: 'playoffs', groupId: null, bracketSide: 'upper', code: 'U3A', round: 3, scoreA: 1, scoreB: 2, scheduledAt: new Date('2026-07-23T19:00:00Z') },
    { ...base, id: 'gf', stageId: 'playoffs', groupId: null, bracketSide: 'final', code: 'GF', round: 4, scoreA: null, scoreB: null, status: 'scheduled', scheduledAt: null },
    { ...base, id: 'pdl', stageId: 'groups', groupId: 'g-b', matchday: 4, scoreA: 2, scoreB: 0, scheduledAt: new Date('2026-03-09T18:00:00Z') },
    { ...base, id: 'sw', stageId: 'swiss', groupId: null, round: 2, scoreA: 2, scoreB: 1, scheduledAt: new Date('2026-10-28T19:00:00Z') },
  ]);
  r.add(s.games, [
    { tournamentId: t, id: '8910469903', matchId: 'ub-r3-p1', number: 3, dotaMatchId: 8910469903, startedAt: new Date('2026-07-23T21:13:11Z') },
    { tournamentId: t, id: 'ub-r3-p1-forfeit-1', matchId: 'ub-r3-p1', number: 1, dotaMatchId: null, startedAt: null },
    // Played on 25 June, a day after its schedule: the label gives the day it was played.
    { tournamentId: t, id: '8864879466', matchId: 'HVwwRd87bSFsCzkph25p', number: 1, dotaMatchId: 8864879466, startedAt: new Date('2026-06-25T17:37:27Z') },
  ]);
  return r;
}

describe('a readable match label', () => {
  const labels = new MatchLabels(rows(), 'wiosenna');

  it.each([
    ['HVwwRd87bSFsCzkph25p', 'Wiosenna Furia, Grupa B, 25 June 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:1 (HVwwRd87bSFsCzkph25p)'],
    ['ub-r3-p1', 'Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2 (ub-r3-p1)'],
    ['gf', 'Wiosenna Furia, final (GF), no date, Chrupek zamknij się vs Adaś, ile za tę Robotę?, not played (gf)'],
    ['pdl', 'Wiosenna Furia, Grupa B, matchday 4, 9 March 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 2:0 (pdl)'],
    ['sw', 'Wiosenna Furia, Swiss, round 2, 28 October 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 2:1 (sw)'],
    ['nope', 'match nope (not imported)'],
  ])('names %s', (id, label) => {
    expect(labels.match(id)).toBe(label);
  });

  it('names a game with its number, Dota id and Warsaw time, by row id or by its old forfeit id', () => {
    expect(labels.game('ub-r3-p1', '8910469903')).toBe('Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)');
    expect(labels.game('ub-r3-p1', 'forfeit_game1')).toMatch(/, game 1 \(forfeited game; match ub-r3-p1\)$/);
  });

  it('names a game by the match it is in now, also when the reference names the match it was stored under', () => {
    expect(labels.game('HVwwRd87bSFsCzkph25p', '8910469903')).toMatch(/^Wiosenna Furia, upper bracket round 3 \(U3A\)/);
  });
});

describe('the subject of a finding', () => {
  it.each([
    ['tournaments/t/matches/HVww/games/8910469903/performances/7656', { matchId: 'HVww', game: '8910469903' }],
    ['matches/KdDx/games/8451487040 (kept)', { matchId: 'KdDx', game: '8451487040' }],
    ['tournaments/t/playoff_matches/ub-r1-p1 2026-07-25', { matchId: 'ub-r1-p1' }],
    ['tournaments/t/matches/003TxGPQS5Rps8vUjZUM = 2026-06-14T19:00', { matchId: '003TxGPQS5Rps8vUjZUM' }],
    ['tournaments/t/teams/x/players/y', null],
    [undefined, null],
  ])('of %s', (ref, subject) => {
    expect(subjectOf(ref)).toEqual(subject);
  });
});
