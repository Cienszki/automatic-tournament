// A standard Swiss of eight teams over three bo3 rounds, seeded by MMR: the shape of swiss-test.
// Also exports the round bookkeeping the LAN qualifier shares.

import type { MatchRow, StageRow, TournamentRow } from '../builders';
import type { StageState } from '../../../src/platform/db/schema/json/formats';
import { defaultSettings, defaultTheme } from '../defaults';
import { TournamentDraft, type DraftContext } from '../draft';
import { swissPairs, type SwissRecord } from '../formats';
import { firstRoundFor, statusFor, type Phase } from './phase';

const ROUNDS = 3;

/** Wins, losses and opponents of `teamIds` from the completed matches among them. */
export function swissRecords(d: TournamentDraft, teamIds: readonly string[]): SwissRecord[] {
  const records = new Map(teamIds.map((id) => [id, { teamId: id, wins: 0, losses: 0, opponents: new Set<string>() }]));
  for (const m of d.world.matches) {
    const a = m.teamAId && records.get(m.teamAId);
    const b = m.teamBId && records.get(m.teamBId);
    if (!a || !b || m.status !== 'completed') continue;
    a.opponents.add(b.teamId);
    b.opponents.add(a.teamId);
    if (m.winnerTeamId === a.teamId) { a.wins++; b.losses++; }
    if (m.winnerTeamId === b.teamId) { b.wins++; a.losses++; }
  }
  return teamIds.map((id) => records.get(id)!);
}

/** The `stages.state.rounds` entry of a committed round. */
export function roundState(round: number, matches: MatchRow[], done: boolean): NonNullable<StageState['rounds']>[number] {
  const at = matches[0]?.scheduledAt ?? new Date(0);
  return {
    round, status: done ? 'complete' : 'committed', bestOf: 3,
    scheduling: { mode: 'fixed', fixedAt: at.toISOString() },
    pairings: matches.map((m) => ({ teamAId: m.teamAId!, teamBId: m.teamBId!, matchId: m.id, isBye: false })),
    standingsSnapshot: [],
    generatedAt: new Date(at.getTime() - 3 * 24 * 3_600_000).toISOString(),
    committedAt: new Date(at.getTime() - 2 * 24 * 3_600_000).toISOString(),
  };
}

export function buildSwiss(ctx: DraftContext, phase: Phase, teamNames: readonly string[]): TournamentDraft {
  const played = phase === 'registration' ? 0 : phase === 'mid-season' ? 2 : ROUNDS;
  const d = new TournamentDraft(ctx, {
    id: 'seed-swiss', name: 'Turniej szwajcarski', shortName: 'Swiss', formatPreset: 'swiss', status: statusFor(phase),
    theme: defaultTheme('#c084fc') as TournamentRow['theme'],
    settings: defaultSettings({ registrationOpen: phase === 'registration' }) as TournamentRow['settings'],
  });
  const stageId = d.stage({
    id: 'swiss', kind: 'swiss', name: 'System szwajcarski', defaultBestOf: 3,
    status: phase === 'registration' ? 'planned' : played === ROUNDS ? 'complete' : 'active',
    settings: { format: 'standard', useMmrSeeding: true, plannedRounds: ROUNDS, allowConsecutiveRematch: false },
  });
  const groupId = d.group({ id: 'swiss', stageId, name: 'Swiss', settings: { isSwissField: true } });
  const teams = d.teams(teamNames.slice(0, 8), { mmr: [2500, 6000] });
  const seeded = [...teams].sort((x, y) => seedMmr(d, y) - seedMmr(d, x));
  d.join(groupId, seeded);
  if (phase === 'registration') return d;

  const first = firstRoundFor(ctx.now, played);
  const rounds: NonNullable<StageState['rounds']> = [];
  // Every played round, and the one after it, are committed (paired and scheduled).
  for (let round = 1; round <= Math.min(ROUNDS, played + 1); round++) {
    const pairs = round === 1
      ? seeded.slice(0, 4).map((t, i) => [t, seeded[i + 4]] as [string, string])
      : swissPairs(swissRecords(d, seeded));
    const matches = pairs.map(([a, b], k) => d.match({
      id: `r${round}-m${k + 1}`, stageId, groupId, round, bestOf: 3, teamAId: a, teamBId: b, scheduledAt: d.roundTime(first, round, k),
    }));
    if (round <= played) matches.forEach((m) => d.play(m));
    rounds.push(roundState(round, matches, round <= played));
  }
  setState(d.world.stages.find((s) => s.id === stageId)!, { tieDecisions: [], currentRound: Math.min(ROUNDS, played + 1), rounds });
  return d;
}

export function seedMmr(d: TournamentDraft, teamId: string): number {
  return d.world.teams.find((t) => t.id === teamId)?.seedMmr ?? 0;
}

export function setState(stage: StageRow, state: StageState): void {
  stage.state = state;
}
