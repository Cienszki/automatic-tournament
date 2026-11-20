// A league with three divisions of six teams, one round-robin leg (five matchdays), bo2 matches
// on fixed evenings: the shape of PDL S1.

import { defaultSettings, defaultTheme } from '../defaults';
import { TournamentDraft, type DraftContext } from '../draft';
import { roundRobin } from '../formats';
import type { Phase } from './phase';
import { firstRoundFor, statusFor } from './phase';
import type { TournamentRow } from '../builders';

const DIVISIONS = [
  { id: 'elite', name: 'Elite', tier: 1, color: '#d4af37', matchdayLabel: 'Czwartek 20:00' },
  { id: 'challenger', name: 'Challenger', tier: 2, color: '#9aa4b2', matchdayLabel: 'Wtorek 20:00' },
  { id: 'adept', name: 'Adept', tier: 3, color: '#b87333', matchdayLabel: 'Środa 20:00' },
] as const;
const ROUNDS = 5;

export function buildLeague(ctx: DraftContext, phase: Phase, teamNames: readonly string[]): TournamentDraft {
  const played = phase === 'registration' ? 0 : phase === 'mid-season' ? 3 : ROUNDS;
  const d = new TournamentDraft(ctx, {
    id: 'seed-liga', name: 'Liga testowa', shortName: 'Liga', formatPreset: 'league', status: statusFor(phase),
    theme: defaultTheme('#4fa3ff') as TournamentRow['theme'],
    settings: defaultSettings({ registrationOpen: phase === 'registration' }) as TournamentRow['settings'],
  });
  const stageId = d.stage({
    id: 'league', kind: 'round_robin', name: 'Sezon zasadniczy', defaultBestOf: 2,
    status: phase === 'registration' ? 'planned' : played === ROUNDS ? 'complete' : 'active',
    settings: { legs: 1, rounds: ROUNDS },
  });
  const first = firstRoundFor(ctx.now, played);
  DIVISIONS.forEach((division, i) => {
    const groupId = d.group({ id: division.id, stageId, name: division.name, tier: division.tier, color: division.color, settings: { matchdayLabel: division.matchdayLabel } });
    const names = teamNames.slice(i * 6, i * 6 + 6);
    const teams = d.teams(names, { status: (_, j) => (phase === 'registration' && j >= 4 ? 'pending' : 'verified') });
    d.join(groupId, teams);
    if (phase === 'registration') return;
    roundRobin(teams).forEach((pairs, r) => pairs.forEach(([a, b], k) => {
      const match = d.match({
        id: `${division.id}-r${r + 1}-m${k + 1}`, stageId, groupId, round: r + 1, matchday: r + 1, bestOf: 2,
        teamAId: a, teamBId: b, schedulingMethod: 'fixed', scheduledAt: d.roundTime(first, r + 1, i),
      });
      if (r < played) d.play(match);
    }));
  });
  return d;
}
