// Reads about tournaments as a whole (server only).

import 'server-only';
import { asc, ne } from 'drizzle-orm';
import { tournaments, type Db } from '@/platform/db';
import type { ListedTournament } from './domain/sitemap';

/**
 * Every tournament that is not a draft, by slug: what the sitemap lists. A statement across
 * tournaments on purpose; it reads one narrow row per tournament.
 */
export async function listListedTournaments(db: Db): Promise<ListedTournament[]> {
  return db
    .select({ slug: tournaments.slug, formatPreset: tournaments.formatPreset, status: tournaments.status, updatedAt: tournaments.updatedAt })
    .from(tournaments)
    .where(ne(tournaments.status, 'draft'))
    .orderBy(asc(tournaments.slug));
}
