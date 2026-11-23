// The dataset's players: everyone with a name who played a counted game. Roster players carry
// their team, position and picture; stand-ins carry only a name and get their team later, from
// the games they played (derive-players.ts).

import type { InputMember, TournamentInput } from '../input';
import type { DsPlayer } from '../types';

/** `team_members.position` → the role label the hub and the performance score use. */
export const ROLE_OF_POSITION: Readonly<Record<string, string>> = {
  carry: 'Carry', mid: 'Mid', offlane: 'Offlane', soft_support: 'Soft Support', hard_support: 'Hard Support',
};

type Entry = Omit<DsPlayer, 'id'>;

function rosterOrder(a: InputMember, b: InputMember): number {
  // Former roster entries first, so the current one has the last word.
  return Number(a.leftAt === null) - Number(b.leftAt === null) || a.joinedAt.getTime() - b.joinedAt.getTime();
}

export function datasetPlayers(input: TournamentInput, played: ReadonlySet<string>): DsPlayer[] {
  const players = new Map<string, DsPlayer>();
  const add = (id: string | null, p: Entry) => {
    if (!id || !p.name) return;
    const prev = players.get(id);
    if (prev && !prev.standin && p.standin) return;
    players.set(id, { ...prev, ...p, id, avatar: p.avatar || prev?.avatar });
  };
  const roster = input.members.filter((m) => m.kind !== 'coach').sort(rosterOrder);
  for (const m of roster) {
    add(m.steamId64, {
      name: m.nickname, teamId: m.teamId,
      role: m.position ? ROLE_OF_POSITION[m.position] : undefined, avatar: m.avatarUrl ?? undefined,
    });
  }
  for (const s of input.standins) add(s.steamId64, { name: s.nickname, standin: true });
  return [...players.values()].filter((p) => played.has(p.id)).map(withoutUndefined);
}

function withoutUndefined(p: DsPlayer): DsPlayer {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as unknown as DsPlayer;
}
