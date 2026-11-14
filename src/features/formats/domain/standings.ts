// The table of one group: who is ahead of whom, by the stage's ranking rules. One function for
// round robin and Swiss alike; the stage kind only chooses the default rules (ranking/defaults.ts).

import { orderTeams } from './ranking/engine';
import { buildContext } from './ranking/records';
import { isDecisionTiebreaker } from './ranking/schema';
import { tiersByValue } from './ranking/tiebreaker';
import { TIEBREAKERS } from './ranking/tiebreakers/catalogue';
import type { OpenTie, StandingRow, Standings, StandingsInput } from './ranking/types';

/**
 * Orders the teams by points, then by each tie-breaker in turn among the teams still level.
 * Teams level after every rule share a place. A tie that reaches `tiebreak_match` or `manual`
 * without a decision is reported in `openTies` and on the rows.
 */
export function computeStandings(input: StandingsInput): Standings {
  const ids = input.teams.map((t) => t.id);
  if (new Set(ids).size !== ids.length) throw new Error('computeStandings: a team is listed twice');

  const ctx = buildContext(input);
  const byPoints = tiersByValue(ids, (id) => ctx.records.get(id)!.points, 'higher').tiers;
  const rules = input.rules.tiebreakers.map((id) => TIEBREAKERS[id]);
  const isDecisive = input.rules.tiebreakOnlyWhenDecisive ? input.isDecisive : undefined;
  const ordered = orderTeams(byPoints, rules, ctx, { isDecisive });

  const rows: StandingRow[] = [];
  const openTies: OpenTie[] = [];
  let place = 1;
  for (const tier of ordered.tiers) {
    const shared = tier.teamIds.length > 1;
    const awaiting = tier.awaiting.filter(isDecisionTiebreaker);
    const openTie: OpenTie | undefined = shared && awaiting.length
      ? { teamIds: tier.teamIds, awaiting, places: { first: place, last: place + tier.teamIds.length - 1 } }
      : undefined;
    if (openTie) openTies.push(openTie);
    for (const teamId of tier.teamIds) {
      rows.push({
        teamId,
        teamName: ctx.teams.get(teamId)!.name,
        place,
        sharedPlace: shared,
        record: ctx.records.get(teamId)!,
        tiebreakers: ordered.values.get(teamId) ?? [],
        ...(openTie ? { openTie } : {}),
      });
    }
    place += tier.teamIds.length;
  }
  return { rows, openTies };
}
