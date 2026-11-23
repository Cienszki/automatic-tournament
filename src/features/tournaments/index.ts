// tournaments: reads about tournaments as a whole, across the platform.
// Owns the sitemap's list of tournaments and its page rules. Does not own a tournament's own pages
// (each feature reads its part) or creating and editing tournaments (WP-43, WP-18a).
// Entry points: sitemapEntries (pure); the server read listListedTournaments is in queries.ts.

export { sitemapEntries, type ListedTournament, type SitemapEntry } from './domain/sitemap';
