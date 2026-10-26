/**
 * Lobby name for a match: "RJ vs NAF - Polish Dota League Sezon 2". Tags come first because the
 * Dota lobby browser cuts long names — players must see whose lobby it is. The bot appends
 * " - Game N" for later games of a series. Keep in sync with bot-worker/dist/scheduling.js.
 */
export function lobbyNameFor(tournamentName: string, a?: { tag?: string; name?: string } | null, b?: { tag?: string; name?: string } | null): string {
  const short = (t?: { tag?: string; name?: string } | null) => (t?.tag || '').trim() || (t?.name || '').trim() || 'TBA';
  return `${short(a)} vs ${short(b)} - ${tournamentName}`;
}
