import { describe, expect, it } from 'vitest';
import { buildTeamList, type GroupRow, type MemberRow, type TeamRow } from './team-list';

const team = (id: string, name: string, status: TeamRow['status'] = 'verified'): TeamRow => ({ id, name, tag: null, logoUrl: null, status });
const group = (teamId: string, groupName: string, stagePosition = 1, groupPosition = 1): GroupRow => ({ teamId, groupName, stagePosition, groupPosition });

describe('buildTeamList', () => {
  it('orders teams by group, then by name, with teams in no group last', () => {
    const list = buildTeamList(
      [team('a', 'Zeta'), team('b', 'Alfa'), team('c', 'Beta'), team('d', 'Gamma')],
      [],
      [group('a', 'Grupa A', 1, 1), group('b', 'Grupa B', 1, 2), group('c', 'Grupa A', 1, 1)],
    );
    expect(list.map((t) => [t.name, t.group])).toEqual([['Beta', 'Grupa A'], ['Zeta', 'Grupa A'], ['Alfa', 'Grupa B'], ['Gamma', null]]);
  });

  it('shows the group of the earliest stage when a team plays in several', () => {
    const [t] = buildTeamList([team('a', 'A')], [], [group('a', 'Playoffs', 2, 1), group('a', 'Elite', 1, 1)]);
    expect(t.group).toBe('Elite');
  });

  it('lists players by position, then substitutes, then coaches', () => {
    const members: MemberRow[] = [
      { teamId: 'a', nickname: 'coach', kind: 'coach', position: null },
      { teamId: 'a', nickname: 'sub', kind: 'substitute', position: null },
      { teamId: 'a', nickname: 'five', kind: 'player', position: 'hard_support' },
      { teamId: 'a', nickname: 'one', kind: 'player', position: 'carry' },
      { teamId: 'a', nickname: 'two', kind: 'player', position: 'mid' },
    ];
    const [t] = buildTeamList([team('a', 'A')], members, []);
    expect(t.members.map((m) => m.nickname)).toEqual(['one', 'two', 'five', 'sub', 'coach']);
  });

  it('lists every team with its status, as the old page does', () => {
    const list = buildTeamList([team('a', 'A', 'rejected'), team('b', 'B', 'pending'), team('c', 'C', 'eliminated')], [], []);
    expect(list.map((t) => [t.id, t.status])).toEqual([['a', 'rejected'], ['b', 'pending'], ['c', 'eliminated']]);
  });

  it('gives a team with no roster rows an empty roster', () => {
    expect(buildTeamList([team('a', 'A')], [], [])[0].members).toEqual([]);
  });
});
