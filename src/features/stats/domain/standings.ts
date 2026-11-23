// The table of every group of every ranked stage (round robin and Swiss), from the tournament's
// rows through the formats feature's computeStandings. Bracket stages have no table.

import {
  computeStandings, defaultRankingRules, parseRankingRules, type RankingRules, type Standings, type StandingsMatch,
  type StandingsTeam,
} from '@/features/formats';
import type { InputStage, TournamentInput } from './input';

export interface GroupStandings {
  stageId: string;
  groupId: string;
  groupName: string;
  rules: RankingRules;
  standings: Standings;
}

function rulesOf(stage: InputStage): RankingRules {
  if (stage.kind === 'bracket') throw new Error('rulesOf: a bracket stage has no ranking');
  return stage.ranking ? parseRankingRules(stage.ranking) : defaultRankingRules(stage.kind);
}

/** Total MMR of each team's current players, for `lower_mmr`. Unknown MMR is left out, not 0. */
function rosterMmr(input: TournamentInput): Map<string, number> {
  const mmr = new Map<string, number>();
  for (const m of input.members) {
    if (m.leftAt || m.kind === 'coach' || !m.mmr || m.mmr <= 0) continue;
    mmr.set(m.teamId, (mmr.get(m.teamId) ?? 0) + m.mmr);
  }
  return mmr;
}

export function standingsPerGroup(input: TournamentInput): GroupStandings[] {
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const mmr = rosterMmr(input);
  const replaced = new Set(input.matches.map((m) => m.replacesMatchId).filter(Boolean));
  const stages = [...input.stages].sort((a, b) => a.position - b.position).filter((s) => s.kind !== 'bracket');
  return stages.flatMap((stage) => {
    const rules = rulesOf(stage);
    return input.groups.filter((g) => g.stageId === stage.id).sort((a, b) => a.position - b.position).map((group) => {
      const teams: StandingsTeam[] = input.groupTeams.filter((gt) => gt.groupId === group.id).flatMap((gt) => {
        const team = teamById.get(gt.teamId);
        if (!team) return [];
        return [{ id: team.id, name: team.name, ...(mmr.has(team.id) ? { mmr: mmr.get(team.id)! } : {}), ...(gt.seed !== null ? { seed: gt.seed } : {}) }];
      });
      const matches: StandingsMatch[] = input.matches.filter((m) => m.groupId === group.id).map((m) => ({
        id: m.id, teamAId: m.teamAId, teamBId: m.teamBId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status,
        kind: m.kind, replaced: replaced.has(m.id), round: m.round,
      }));
      return { stageId: stage.id, groupId: group.id, groupName: group.name, rules, standings: computeStandings({ teams, matches, rules }) };
    });
  });
}
