// The public list of a tournament's teams: who plays, in which group, with which roster. Built from
// rows by a pure function so the order and the roster rules are tested without a database.

export type TeamStatus = 'pending' | 'verified' | 'rejected' | 'warning' | 'banned' | 'eliminated';
export type Position = 'carry' | 'mid' | 'offlane' | 'soft_support' | 'hard_support';
export type MemberKind = 'player' | 'substitute' | 'coach';

export interface TeamListMember {
  nickname: string;
  kind: MemberKind;
  position: Position | null;
}

export interface TeamListItem {
  id: string;
  name: string;
  tag: string | null;
  logoUrl: string | null;
  status: TeamStatus;
  /** The team's group in the earliest stage that has groups, or null. */
  group: string | null;
  members: TeamListMember[];
}

export interface TeamRow { id: string; name: string; tag: string | null; logoUrl: string | null; status: TeamStatus }
export interface MemberRow { teamId: string; nickname: string; kind: MemberKind; position: Position | null }
export interface GroupRow { teamId: string; groupName: string; stagePosition: number; groupPosition: number }

const POSITION_ORDER: Record<Position, number> = { carry: 1, mid: 2, offlane: 3, soft_support: 4, hard_support: 5 };
const KIND_ORDER: Record<MemberKind, number> = { player: 0, substitute: 1, coach: 2 };

function byRole(a: TeamListMember, b: TeamListMember): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    || (a.position ? POSITION_ORDER[a.position] : 9) - (b.position ? POSITION_ORDER[b.position] : 9)
    || a.nickname.localeCompare(b.nickname, 'pl');
}

/**
 * Teams in group order (earliest stage, then group position), then by name; teams in no group come
 * last. Players by position, then substitutes, then coaches. Every team is listed, whatever its
 * status, as on the old page (which shows the status as a badge); WP-09 decides what to hide.
 */
export function buildTeamList(teams: TeamRow[], members: MemberRow[], groups: GroupRow[]): TeamListItem[] {
  const firstGroup = new Map<string, GroupRow>();
  for (const g of groups) {
    const seen = firstGroup.get(g.teamId);
    if (!seen || g.stagePosition < seen.stagePosition || (g.stagePosition === seen.stagePosition && g.groupPosition < seen.groupPosition)) {
      firstGroup.set(g.teamId, g);
    }
  }
  const roster = new Map<string, TeamListMember[]>();
  for (const m of members) {
    const list = roster.get(m.teamId) ?? [];
    list.push({ nickname: m.nickname, kind: m.kind, position: m.position });
    roster.set(m.teamId, list);
  }
  const groupKey = (id: string) => {
    const g = firstGroup.get(id);
    return g ? g.stagePosition * 10_000 + g.groupPosition : Number.MAX_SAFE_INTEGER;
  };
  return teams
    .map((t) => ({
      ...t,
      group: firstGroup.get(t.id)?.groupName ?? null,
      members: (roster.get(t.id) ?? []).sort(byRole),
    }))
    .sort((a, b) => groupKey(a.id) - groupKey(b.id) || a.name.localeCompare(b.name, 'pl'));
}
