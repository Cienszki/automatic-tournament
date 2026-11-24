// tournaments: reads about tournaments as a whole, and what every tournament page shows around its
// content: the theme as CSS variables and the links inside a tournament.
// Owns the sitemap's list of tournaments and its page rules, the slug lookup, the page frame, the
// theme's CSS variables and `tournamentHref`. Does not own a tournament's own pages (each feature
// reads its part) or creating and editing tournaments (WP-43, WP-18a).
// Entry points: sitemapEntries, themeCssVariables, tournamentHref (pure), TournamentTheme
// (component); the server reads are in queries.ts.

export { sitemapEntries, type ListedTournament, type SitemapEntry } from './domain/sitemap';
export { themeCssVariables, type CssVariables } from './domain/theme';
export { tournamentHref, type Linkable } from './domain/links';
export { TournamentTheme } from './components/TournamentTheme';
