// On dota2inhouse.pl every request first goes through the community site (Vercel), which passes it on
// to our Firebase app: ~0.1 s more per request. The card game's own API talks to Firebase directly
// (its route allows these origins, see src/app/api/cards/duel/route.ts); elsewhere (localhost, the
// Firebase host itself) the path stays relative.

export const GAME_HOST = 'https://tournament-tracker-f35tb.web.app';

export function gameApi(path: string): string {
  if (typeof window === 'undefined') return path;
  return /(^|\.)dota2inhouse\.pl$/.test(window.location.hostname) ? `${GAME_HOST}${path}` : path;
}
