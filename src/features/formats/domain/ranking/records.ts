// Each team's record from the matches that count, and the context the tie-breakers read.

import { countsForStandings, seriesOutcome } from '../series';
import type { PointsRule, RankingRules } from './schema';
import type { StandingsInput, StandingsMatch, StandingsTeam, TeamId, TeamRecord } from './types';

/** A played series between two teams of the table, reduced to what the rules compare. */
export interface PlayedSeries {
  teamAId: TeamId;
  teamBId: TeamId;
  scoreA: number;
  scoreB: number;
}

export interface RankingContext {
  rules: RankingRules;
  teams: ReadonlyMap<TeamId, StandingsTeam>;
  records: ReadonlyMap<TeamId, TeamRecord>;
  /** Counting results between two teams of the table (byes excluded). */
  results: readonly PlayedSeries[];
  /** Tiebreak matches between two teams of the table, played or not. */
  tiebreaks: readonly StandingsMatch[];
}

/** Points one side earns from a series result. */
export function pointsFor(rule: PointsRule, own: number, opponent: number): number {
  if (rule === 'games_won') return own;
  const outcome = seriesOutcome(own, opponent);
  return outcome === 'a' ? rule.win : outcome === 'draw' ? rule.draw : rule.loss;
}

const emptyRecord = (): TeamRecord => ({
  played: 0, wins: 0, draws: 0, losses: 0, gamesWon: 0, gamesLost: 0, points: 0, neustadtl: 0, buchholz: 0,
});

/** One side of one counting result. `opponentId` is null for a bye. */
interface Side {
  teamId: TeamId;
  opponentId: TeamId | null;
  own: number;
  opponent: number;
}

function sidesOf(m: StandingsMatch, inTable: (id: TeamId | null) => id is TeamId): Side[] {
  const { teamAId: a, teamBId: b } = m;
  const scoreA = m.scoreA ?? 0;
  const scoreB = m.scoreB ?? 0;
  if (a !== null && b !== null) {
    // A result against a team outside the table counts for neither side.
    if (!inTable(a) || !inTable(b)) return [];
    return [
      { teamId: a, opponentId: b, own: scoreA, opponent: scoreB },
      { teamId: b, opponentId: a, own: scoreB, opponent: scoreA },
    ];
  }
  if (m.status !== 'bye') return [];
  if (inTable(a)) return [{ teamId: a, opponentId: null, own: scoreA, opponent: scoreB }];
  if (inTable(b)) return [{ teamId: b, opponentId: null, own: scoreB, opponent: scoreA }];
  return [];
}

export function buildContext(input: StandingsInput): RankingContext {
  const { rules } = input;
  const teams = new Map(input.teams.map((t) => [t.id, t]));
  const inTable = (id: TeamId | null): id is TeamId => id !== null && teams.has(id);
  const inRounds = (m: StandingsMatch) => input.throughRound === undefined || m.round <= input.throughRound;

  const records = new Map<TeamId, TeamRecord>(input.teams.map((t) => [t.id, emptyRecord()]));
  const sides: Side[] = [];
  const results: PlayedSeries[] = [];
  for (const m of input.matches) {
    if (!inRounds(m) || !countsForStandings(m)) continue;
    const ms = sidesOf(m, inTable);
    sides.push(...ms);
    if (ms.length === 2) results.push({ teamAId: ms[0].teamId, teamBId: ms[1].teamId, scoreA: ms[0].own, scoreB: ms[1].own });
  }

  for (const s of sides) {
    const r = records.get(s.teamId)!;
    const outcome = seriesOutcome(s.own, s.opponent);
    r.played += 1;
    if (outcome === 'a') r.wins += 1;
    else if (outcome === 'b') r.losses += 1;
    else r.draws += 1;
    r.gamesWon += s.own;
    r.gamesLost += s.opponent;
    r.points += pointsFor(rules.points, s.own, s.opponent);
  }

  // Second pass: schedule strength needs every team's final points.
  for (const s of sides) {
    if (s.opponentId === null) continue;
    const r = records.get(s.teamId)!;
    const opponentPoints = records.get(s.opponentId)!.points;
    r.buchholz += opponentPoints;
    const outcome = seriesOutcome(s.own, s.opponent);
    if (outcome === 'a') r.neustadtl += opponentPoints;
    else if (outcome === 'draw') r.neustadtl += opponentPoints / 2;
  }

  const tiebreaks = input.matches.filter(
    (m) => m.kind === 'tiebreak' && !m.replaced && m.status !== 'void' && inRounds(m) && inTable(m.teamAId) && inTable(m.teamBId),
  );
  return { rules, teams, records, results, tiebreaks };
}
