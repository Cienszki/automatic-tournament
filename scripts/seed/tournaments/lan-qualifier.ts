// A LAN qualifier of twelve teams, the shape of PDL S2: the four best seeds play a GSL group (A),
// the other eight a three-round Swiss (B), side by side in rounds 1 to 3, all bo3, in one table.
// The final stage (rounds 4 to 6) is not seeded: "finished" means the first three rounds are done.

import type { TournamentRow } from '../builders';
import { defaultSettings, defaultTheme } from '../defaults';
import { TournamentDraft, type DraftContext } from '../draft';
import { swissPairs } from '../formats';
import { firstRoundFor, statusFor, type Phase } from './phase';
import { roundState, seedMmr, setState, swissRecords } from './swiss';
import type { MatchRow } from '../builders';
import type { StageState } from '../../../src/platform/db/schema/json/formats';

const ROUNDS = 3;

export function buildLanQualifier(ctx: DraftContext, phase: Phase, teamNames: readonly string[]): TournamentDraft {
  const played = phase === 'registration' ? 0 : phase === 'mid-season' ? 2 : ROUNDS;
  const d = new TournamentDraft(ctx, {
    id: 'seed-lan', name: 'Kwalifikacje LAN', shortName: 'LAN', formatPreset: 'swiss', status: statusFor(phase), leagueId: 99999,
    theme: defaultTheme('#ff7a45') as TournamentRow['theme'],
    settings: defaultSettings({ registrationOpen: phase === 'registration' }) as TournamentRow['settings'],
  });
  const stageId = d.stage({
    id: 'qualifier', kind: 'swiss', name: 'Kwalifikacje', defaultBestOf: 3,
    status: phase === 'registration' ? 'planned' : played === ROUNDS ? 'complete' : 'active',
    settings: { format: 'lan-qualifier', useMmrSeeding: true, pairingBand: 1500, plannedRounds: ROUNDS, allowConsecutiveRematch: false },
  });
  const groupId = d.group({ id: 'swiss', stageId, name: 'Kwalifikacje', settings: { isSwissField: true } });
  const teams = d.teams(teamNames.slice(0, 12), { mmr: [3000, 7000] });
  const seeded = [...teams].sort((x, y) => seedMmr(d, y) - seedMmr(d, x));
  d.join(groupId, seeded);
  const groupA = seeded.slice(0, 4);
  const groupB = seeded.slice(4);
  if (phase === 'registration') {
    setState(d.world.stages[0], { tieDecisions: [], lanQualifier: { groupA: [] } });
    return d;
  }

  const first = firstRoundFor(ctx.now, played);
  const rounds: NonNullable<StageState['rounds']> = [];
  for (let round = 1; round <= Math.min(ROUNDS, played + 1); round++) {
    const at = (k: number) => d.roundTime(first, round, k);
    const gsl = gslRound(d, round, groupA).map(([slot, a, b], k) => d.match({
      id: `r${round}-${slot}`, stageId, groupId, round, bestOf: 3, teamAId: a, teamBId: b, code: slot, scheduledAt: at(k),
    }));
    const swiss = (round === 1
      ? groupB.slice(0, 4).map((t, i) => [t, groupB[i + 4]] as [string, string])
      : swissPairs(swissRecords(d, groupB))
    ).map(([a, b], k) => d.match({
      id: `r${round}-m${k + 1}`, stageId, groupId, round, bestOf: 3, teamAId: a, teamBId: b, scheduledAt: at(k + gsl.length),
    }));
    const matches: MatchRow[] = [...gsl, ...swiss];
    if (round <= played) matches.forEach((m) => d.play(m));
    rounds.push(roundState(round, matches, round <= played));
  }
  setState(d.world.stages[0], {
    tieDecisions: [], currentRound: Math.min(ROUNDS, played + 1), rounds, lanQualifier: { groupA },
  });
  return d;
}

/** The GSL group's matches of a round: openers, then winners' and losers' matches, then the decider. */
function gslRound(d: TournamentDraft, round: number, groupA: string[]): [string, string, string][] {
  const slot = (code: string) => d.world.matches.find((m) => m.tournamentId === d.id && m.code === code)!;
  const loser = (m: MatchRow) => (m.winnerTeamId === m.teamAId ? m.teamBId! : m.teamAId!);
  if (round === 1) return [['o1', groupA[0], groupA[1]], ['o2', groupA[2], groupA[3]]];
  const o1 = slot('o1');
  const o2 = slot('o2');
  if (round === 2) return [['w', o1.winnerTeamId!, o2.winnerTeamId!], ['l', loser(o1), loser(o2)]];
  return [['d', loser(slot('w')), slot('l').winnerTeamId!]];
}
