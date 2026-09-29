// src/lib/reserved-slugs.ts
// Slugs that may NOT be used as tournament slugs.
//
// Tournament pages are served at /[tournamentSlug] on the same domain as the
// main site (dota2inhouse.pl), so a slug that matches an existing app route, a
// framework/static path, or a public asset folder would shadow (or be shadowed
// by) the real thing.
//
// The failure is silent and one-directional: Next.js resolves STATIC routes
// before the dynamic [tournamentSlug] segment, so a tournament whose slug
// collides simply becomes unreachable — it exists in Firestore, the admin panel
// works, but visiting its URL serves the other page instead.
//
// Two apps share the domain, so both must be covered:
//   - the community site  (c:/Users/wilqw/Desktop/code/dota.pl/dota2-community-site)
//   - this tournament app
//
// `src/__tests__/reserved-slugs.test.ts` walks this repo's actual route and
// public directories and fails if any of them is missing from this list, so new
// routes cannot silently reintroduce the hazard.

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // --- Community site routes (dota2inhouse.pl) ---
  'admin', 'admin-login', 'api', 'auth', 'basher', 'hall-of-fame', 'inhouse',
  'kontakt', 'newsy', 'o-nas', 'players', 'polityka-prywatnosci', 'ranking',
  'rekrutacja', 'streamy', 'wesprzyj-nas',

  // --- This app's own top-level routes ---
  // Every directory in src/app must appear here. A tournament slug matching one
  // of these would be shadowed by the static route and never render.
  'creator', 'fantasy', 'faq', 'fonts', 'groups', 'my-team', 'organizer',
  'pickem', 'playoffs', 'register', 'rules', 'schedule', 'standins', 'stats',
  'teams',
  // Polish spelling reserved too, so the route can be renamed later without a
  // tournament already sitting on the new name.
  'organizator',

  // --- Framework + static served at root (both apps are Next.js) ---
  '_next', 'favicon.ico', 'favicon.png', 'icon.png', 'icon1.png', 'icon2.png',
  'robots.txt', 'sitemap.xml', 'llms.txt', '.well-known', 'manifest.json',
  'sw.js', 'opengraph-image', 'apple-icon.png',

  // --- Public asset folders and root files (both apps) ---
  'images', 'ranks', 'backgrounds', 'icons', 'logos',
  'pd2ih_logo.png', 'ih.png', 'dc_logo.png', 'twitch_logo.png',
  'main_logo2.png', 'placeholder-team.svg', 'logo_transparent.webp',

  // --- Common routes & reserved words (PL + EN) ---
  'turnieje', 'turniej', 'login', 'logout', 'signin', 'signout',
  'rejestracja', 'konto', 'account', 'profil', 'profile', 'ustawienia', 'settings',
  'news', 'blog', 'pomoc', 'help', 'regulamin', 'terms', 'privacy', 'about',
  'sponsorzy', 'sponsors', 'partnerzy', 'partners', 'media', 'druzyny',
  'gracze', 'mecz', 'mecze', 'match', 'matches', 'live', 'search', 'szukaj', 'home',
  'dashboard', 'panel', 'discord', 'twitch', 'youtube', 'galeria', 'gallery',
  'sklep', 'shop', 'store', 'download', 'pobierz',
]);

/**
 * Allowed slug shape: lowercase letters, digits and single hyphens, 2–40 chars,
 * starting and ending alphanumeric.
 *
 * This is not cosmetic. Without it a slug could contain `/`, `.`, `%` or spaces
 * and break routing outright, and mixed case would silently 404: the stored
 * value is matched exactly by fetchTournamentBySlug, so a tournament saved as
 * "PDL" is not found at /pdl.
 *
 * Kept in sync with the same expression in firestore.rules.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/;

/**
 * True if `slug` is reserved and must not be used as a tournament slug.
 * Comparison is case-insensitive and ignores surrounding whitespace.
 */
export function isReservedSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/** True if `slug` has a usable shape (see SLUG_PATTERN). */
export function isValidSlugFormat(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return SLUG_PATTERN.test(slug);
}

export type SlugProblem = 'empty' | 'format' | 'reserved';

/**
 * Single place that decides whether a slug may be used, so the wizard, the
 * create call and any future caller cannot disagree.
 * Returns null when the slug is acceptable.
 */
export function validateSlug(slug: string | null | undefined): SlugProblem | null {
  if (!slug || !slug.trim()) return 'empty';
  if (!isValidSlugFormat(slug)) return 'format';
  if (isReservedSlug(slug)) return 'reserved';
  return null;
}

/** Human-readable reason, for surfacing in the wizard. */
export function describeSlugProblem(problem: SlugProblem, slug?: string): string {
  switch (problem) {
    case 'empty':
      return 'Podaj adres strony turnieju.';
    case 'format':
      return 'Adres może zawierać tylko małe litery, cyfry i myślniki (2–40 znaków), ' +
             'i musi zaczynać się oraz kończyć literą lub cyfrą. Np. "letnia-2026".';
    case 'reserved':
      return `Adres "${slug ?? ''}" jest zarezerwowany — koliduje z istniejącą stroną ` +
             `serwisu i turniej byłby pod nim niedostępny. Wybierz inny.`;
  }
}

/** Best-effort conversion of a tournament name into a usable slug. */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  };
  return input
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, ch => map[ch] ?? ch)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
