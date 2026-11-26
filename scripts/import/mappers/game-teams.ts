// Which team played Radiant and which Dire in a game, from its players (WP-33b). The stored labels
// (`radiant_team`, `dire_team`, `manualTeamMapping`) were written by the old sync and by fix
// scripts, and some are wrong: Letnia's 25 August 2025 game 8433022489 names two teams that did
// not play it. When the match has both its teams, the players decide only which of those two was
// Radiant; a game is never given a third team (a side held by a third team's accounts is reported).
// Without both match teams (an unfilled bracket slot), a side's team is the team whose roster holds
// most of that side's accounts. The labels are used only when the players decide nothing.
// Pure: no database, no state.

export type Side = 'radiant' | 'dire';

export interface GamePlayer {
  steamId64: string;
  heroId: number | null;
  /** From a parsed replay, when the performance has it. */
  isRadiant: boolean | null;
}

export interface Pick { heroId: number | null; isPick: boolean | null; team: number | null }

export interface TeamsInput {
  players: readonly GamePlayer[];
  /** OpenDota's picks and bans: `team` 0 is Radiant, 1 is Dire. */
  picks: readonly Pick[];
  labels: { radiant: string | null; dire: string | null };
  /** Account → the teams it may play for in this game (roster, smurf accounts, approved stand-ins). */
  teamsOf: ReadonlyMap<string, readonly string[]>;
  /** The match's two teams. */
  matchTeams: readonly [string | null, string | null];
}

export interface TeamsResult {
  radiant: string | null;
  dire: string | null;
  by: 'players' | 'labels';
  /** The players decided, and named other teams than the labels. */
  disagrees: boolean;
  /** A team outside the match that holds most of one side's accounts (reported, never assigned). */
  otherTeam: string | null;
}

/** Fewest accounts that must agree for the players to decide. */
export const MIN_ACCOUNTS = 2;

/** A player's side: the side that picked their hero, else the replay's flag. */
export function sideOf(player: GamePlayer, picks: readonly Pick[]): Side | null {
  const pick = player.heroId === null ? undefined : picks.find((p) => p.isPick && p.heroId === player.heroId);
  if (pick && (pick.team === 0 || pick.team === 1)) return pick.team === 0 ? 'radiant' : 'dire';
  if (player.isRadiant !== null) return player.isRadiant ? 'radiant' : 'dire';
  return null;
}

/** Accounts per team on one side. */
function tallyOf(input: TeamsInput, side: Side): Map<string, number> {
  const tally = new Map<string, number>();
  for (const p of input.players) {
    if (sideOf(p, input.picks) !== side) continue;
    for (const team of new Set(input.teamsOf.get(p.steamId64) ?? [])) tally.set(team, (tally.get(team) ?? 0) + 1);
  }
  return tally;
}

/** The team with the most accounts on a side, when it has at least MIN_ACCOUNTS and no other team as many. */
function leader(tally: ReadonlyMap<string, number>): string | null {
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < MIN_ACCOUNTS || ranked[1]?.[1] === ranked[0][1]) return null;
  return ranked[0][0];
}

export function resolveGameTeams(input: TeamsInput): TeamsResult {
  const { labels } = input;
  const [a, b] = input.matchTeams;
  const tR = tallyOf(input, 'radiant');
  const tD = tallyOf(input, 'dire');
  const leaders = [leader(tR), leader(tD)];
  const otherTeam = a && b ? leaders.find((t) => t !== null && t !== a && t !== b) ?? null : null;
  let radiant: string | null = null;
  let dire: string | null = null;
  if (a && b) {
    // Accounts that say "a is Radiant" against those that say "b is Radiant".
    const n = (t: Map<string, number>, team: string) => t.get(team) ?? 0;
    const aRadiant = n(tR, a) + n(tD, b);
    const bRadiant = n(tR, b) + n(tD, a);
    if (Math.max(aRadiant, bRadiant) >= MIN_ACCOUNTS && aRadiant !== bRadiant) [radiant, dire] = aRadiant > bRadiant ? [a, b] : [b, a];
  } else {
    [radiant, dire] = leaders;
  }
  if (!radiant || !dire || radiant === dire) return { radiant: labels.radiant, dire: labels.dire, by: 'labels', disagrees: false, otherTeam };
  const labelled = labels.radiant !== null || labels.dire !== null;
  return { radiant, dire, by: 'players', disagrees: labelled && (radiant !== labels.radiant || dire !== labels.dire), otherTeam };
}
