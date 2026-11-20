// Behind the community site every request first goes through its proxy, which passes it on to our
// app: ~0.1 s more per request. When NEXT_PUBLIC_ASSET_ORIGIN names our own host, the card game's
// API talks to it directly (its route allows the site's origins, see
// src/app/api/cards/duel/route.ts). Without it, or on that host itself, the path stays relative.

const OWN_ORIGIN = process.env.NEXT_PUBLIC_ASSET_ORIGIN || '';

export function gameApi(path: string): string {
  if (typeof window === 'undefined' || !OWN_ORIGIN) return path;
  return window.location.origin === OWN_ORIGIN.replace(/\/+$/, '') ? path : `${OWN_ORIGIN.replace(/\/+$/, '')}${path}`;
}
