// src/lib/reserved-slugs.ts
// Slugs that may NOT be used as tournament slugs.
//
// Tournament pages are served at /[tournamentSlug], so a slug that matches an
// existing app route, a framework/static path, or a public asset folder would
// shadow (or be shadowed by) the real thing and break the main website.
//
// Keep this list in sync with the app's top-level routes and public assets.

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // --- App routes ---
  'admin', 'admin-login', 'api', 'auth', 'basher', 'hall-of-fame', 'inhouse',
  'kontakt', 'newsy', 'o-nas', 'players', 'polityka-prywatnosci', 'ranking',
  'rekrutacja', 'streamy', 'wesprzyj-nas',

  // --- Framework + static served at root (both apps are Next.js) ---
  '_next', 'favicon.ico', 'icon1.png', 'icon2.png', 'robots.txt', 'sitemap.xml',
  'llms.txt', '.well-known',

  // --- Public asset folders ---
  'images', 'ranks', 'pd2ih_logo.png',

  // --- Common routes & reserved words (PL + EN) ---
  'turnieje', 'turniej', 'login', 'logout', 'signin', 'signout', 'register',
  'rejestracja', 'konto', 'account', 'profil', 'profile', 'ustawienia', 'settings',
  'news', 'blog', 'faq', 'pomoc', 'help', 'regulamin', 'terms', 'privacy', 'about',
  'sponsorzy', 'sponsors', 'partnerzy', 'partners', 'media', 'druzyny', 'teams',
  'gracze', 'mecz', 'mecze', 'match', 'matches', 'live', 'search', 'szukaj', 'home',
  'dashboard', 'panel', 'discord', 'twitch', 'youtube', 'galeria', 'gallery',
  'sklep', 'shop', 'store', 'download', 'pobierz',
]);

/**
 * True if `slug` is reserved and must not be used as a tournament slug.
 * Comparison is case-insensitive and ignores surrounding whitespace.
 */
export function isReservedSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
