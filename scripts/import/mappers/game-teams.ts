// Which team played Radiant and which Dire in a game, from its players (WP-33b). The stored labels
// (`radiant_team`, `dire_team`, `manualTeamMapping`) were written by the old sync and by fix
// scripts, and some are wrong: Letnia's 25 August 2025 game 8433022489 names two teams that did
// not play it. A side's team is the team whose roster holds most of that side's accounts; the
// labels are used only when the players decide nothing. Pure: no database, no state.

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
}

/** Fewest accounts of one team on a side for the players to decide that side. */
export const MIN_ACCOUNTS = 2;

/** A player's side: the side that picked their hero, else the replay's flag. */
export function sideOf(player: GamePlayer, picks: readonly Pick[]): Side | null {
  const pick = player.heroId === null ? undefined : picks.find((p) => p.isPick && p.heroId === player.heroId);
  if (pick && (pick.team === 0 || pick.team === 1)) return pick.team === 0 ? 'radiant' : 'dire';
  if (player.isRadiant !== null) return player.isRadiant ? 'radiant' : 'dire';
  return null;
}

/** The team with the most accounts on one side, when it has at least MIN_ACCOUNTS and no other team as many. */
function teamOfSide(input: TeamsInput, side: Side): string | null {
  const tally = new Map<string, number>();
  for (const p of input.players) {
    if (sideOf(p, input.picks) !== side) continue;
    for (const team of new Set(input.teamsOf.get(p.steamId64) ?? [])) tally.set(team, (tally.get(team) ?? 0) + 1);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < MIN_ACCOUNTS || ranked[1]?.[1] === ranked[0][1]) return null;
  return ranked[0][0];
}

export function resolveGameTeams(input: TeamsInput): TeamsResult {
  const { labels } = input;
  let radiant = teamOfSide(input, 'radiant');
  let dire = teamOfSide(input, 'dire');
  const [a, b] = input.matchTeams;
  // One side decided: the other is the match's other team.
  if (radiant && !dire && a && b && (radiant === a || radiant === b)) dire = radiant === a ? b : a;
  if (dire && !radiant && a && b && (dire === a || dire === b)) radiant = dire === a ? b : a;
  if (!radiant || !dire || radiant === dire) return { radiant: labels.radiant, dire: labels.dire, by: 'labels', disagrees: false };
  const labelled = labels.radiant !== null || labels.dire !== null;
  return { radiant, dire, by: 'players', disagrees: labelled && (radiant !== labels.radiant || dire !== labels.dire) };
}
