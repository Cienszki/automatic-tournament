// Two groups of four with an MMR cap, then a four-team single-elimination playoff (semifinals bo3,
// final bo5): the shape of Wiosenna. The group places go to the bracket through the stage's
// advancement rules, the way WP-34 will fill brackets.

import type { Advancement } from '../../../src/platform/db/schema/json/formats';
import type { TournamentRow } from '../builders';
import { defaultSettings, defaultTheme } from '../defaults';
import { TournamentDraft, type DraftContext } from '../draft';
import { roundRobin, singleElimination } from '../formats';
import { firstRoundFor, statusFor, type Phase } from './phase';

const GROUPS = ['A', 'B'] as const;
const GROUP_ROUNDS = 3;

/** A1 and B1 meet the other group's second; the rest are out. */
const ADVANCEMENT: Advancement = [
  { from: { group: 'A', place: 1 }, to: { stage: 'playoffs', code: 'R1M1', side: 'a' } },
  { from: { group: 'B', place: 2 }, to: { stage: 'playoffs', code: 'R1M1', side: 'b' } },
  { from: { group: 'B', place: 1 }, to: { stage: 'playoffs', code: 'R1M2', side: 'a' } },
  { from: { group: 'A', place: 2 }, to: { stage: 'playoffs', code: 'R1M2', side: 'b' } },
  { from: { group: 'A', place: 3 }, to: 'eliminated' },
  { from: { group: 'A', place: 4 }, to: 'eliminated' },
  { from: { group: 'B', place: 3 }, to: 'eliminated' },
  { from: { group: 'B', place: 4 }, to: 'eliminated' },
];

export function buildGroupsPlayoffs(ctx: DraftContext, phase: Phase, teamNames: readonly string[]): TournamentDraft {
  const groupRoundsPlayed = phase === 'registration' ? 0 : phase === 'mid-season' ? 2 : GROUP_ROUNDS;
  const bracketRoundsPlayed = phase === 'playoffs' ? 1 : phase === 'finished' ? 2 : 0;
  const d = new TournamentDraft(ctx, {
    id: 'seed-grupy', name: 'Puchar grupowy', shortName: 'Puchar', formatPreset: 'mmr-limited', status: statusFor(phase),
    theme: defaultTheme('#3ddc97') as TournamentRow['theme'],
    settings: defaultSettings({ registrationOpen: phase === 'registration', mmrCap: 20000 }) as TournamentRow['settings'],
  });
  const groupsStage = d.stage({
    id: 'groups', kind: 'round_robin', name: 'Faza grupowa', defaultBestOf: 2, settings: { legs: 1 },
    status: phase === 'registration' ? 'planned' : groupRoundsPlayed === GROUP_ROUNDS ? 'complete' : 'active',
    advancement: ADVANCEMENT,
  });
  const playoffs = d.stage({
    id: 'playoffs', kind: 'bracket', name: 'Playoffy', defaultBestOf: 3,
    status: phase === 'finished' ? 'complete' : phase === 'playoffs' ? 'active' : 'planned',
    settings: { type: 'single', teams: 4, thirdPlaceMatch: false, bestOf: { default: 3, final: 5 }, visible: true },
  });
  const first = firstRoundFor(ctx.now, groupRoundsPlayed + bracketRoundsPlayed);
  GROUPS.forEach((name, i) => {
    const groupId = d.group({ id: name, stageId: groupsStage, name: `Grupa ${name}`, settings: { highlights: [{ color: '#3ddc97', count: 2, from: 'top' }] } });
    const teams = d.teams(teamNames.slice(i * 4, i * 4 + 4), {
      mmr: [1500, 4500], status: (_, j) => (phase === 'registration' && j === 3 ? 'pending' : 'verified'),
    });
    d.join(groupId, teams);
    if (phase === 'registration') return;
    roundRobin(teams).forEach((pairs, r) => pairs.forEach(([a, b], k) => {
      const match = d.match({
        id: `${name}-r${r + 1}-m${k + 1}`, stageId: groupsStage, groupId, round: r + 1, bestOf: 2,
        teamAId: a, teamBId: b, scheduledAt: d.roundTime(first, r + 1, k),
      });
      if (r < groupRoundsPlayed) d.play(match);
    }));
  });
  if (groupRoundsPlayed < GROUP_ROUNDS) return d;

  const [a1, a2] = d.table('A');
  const [b1, b2] = d.table('B');
  const bracket = singleElimination([a1, b1, a2, b2]).map((m) => d.match({
    id: m.id, stageId: playoffs, round: m.round, bestOf: m.id === 'F' ? 5 : 3, teamAId: m.a, teamBId: m.b,
    bracketSide: m.side, bracketPosition: m.position, code: m.id,
    nextWinnerMatchId: m.next?.id, nextWinnerSlot: m.next?.slot,
    scheduledAt: d.roundTime(first, GROUP_ROUNDS + m.round, m.position - 1),
  }));
  // Created first, played after: a winner moves into a match that must already exist.
  bracket.filter((m) => m.round <= bracketRoundsPlayed).forEach((m) => d.play(m));
  d.world.teams.filter((t) => ![a1, a2, b1, b2].includes(t.id)).forEach((t) => { t.status = 'eliminated'; });
  return d;
}
