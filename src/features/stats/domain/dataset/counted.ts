// Which matches and games the stats hub counts.

import type { InputGame, InputMatch, InputTeam, TournamentInput } from '../input';

/**
 * A walkover given because a team was banned (old `isBanForfeit`): the whole series forfeited by
 * a team that is now banned, with no game played. The old site leaves these out of its stats; the
 * standings count them. A series the organizer gave to one side after its games were played (PDL
 * S1, 9 March 2026, Bociarnia Junior vs Dream Stack) keeps its games, whoever is banned later.
 */
export function isBanForfeit(m: InputMatch, teamById: ReadonlyMap<string, InputTeam>, played: ReadonlySet<string> = new Set()): boolean {
  return m.forfeitScope === 'series' && !!m.forfeitTeamId && teamById.get(m.forfeitTeamId)?.status === 'banned' && !played.has(m.id);
}

/**
 * Completed series whose games count in player and team stats: everything finished except a
 * replayed original (its rematch counts instead), a bye, and a ban walkover. Ordered by
 * completion time.
 */
export function countedMatches(input: TournamentInput): InputMatch[] {
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const replaced = new Set(input.matches.map((m) => m.replacesMatchId).filter((id): id is string => !!id));
  const played = new Set(input.games.filter((g) => !g.isForfeit).map((g) => g.matchId));
  return input.matches
    .filter((m) => m.status === 'completed' && !replaced.has(m.id) && !isBanForfeit(m, teamById, played))
    .sort((a, b) => time(a) - time(b) || compareIds(a.id, b.id));
}

const time = (m: InputMatch) => (m.completedAt ?? m.scheduledAt)?.getTime() ?? 0;
export const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const startSeconds = (g: InputGame) => (g.startedAt ? Math.floor(g.startedAt.getTime() / 1000) : 0);

/** Played games of the counted matches, with both teams known, in order of start. */
export function countedGames(input: TournamentInput, matches: readonly InputMatch[]): InputGame[] {
  const ids = new Set(matches.map((m) => m.id));
  return input.games
    .filter((g) => ids.has(g.matchId) && !g.isForfeit && g.radiantTeamId && g.direTeamId)
    .sort((a, b) => startSeconds(a) - startSeconds(b) || compareIds(a.id, b.id));
}
