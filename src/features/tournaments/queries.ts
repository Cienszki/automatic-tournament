// Reads about tournaments as a whole (server only).

import 'server-only';
import { and, asc, eq, ne } from 'drizzle-orm';
import { cachedQuery, tags, tournamentTags } from '@/platform/cache';
import { getDb, tournaments, type Db } from '@/platform/db';
import type { Theme } from '@/platform/db/schema/json';
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

/** The id of the public tournament at this slug, or null. Drafts are not public (WP-08 adds preview access). */
export async function findPublicTournamentId(db: Db, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, 'draft')))
    .limit(1);
  return row?.id ?? null;
}

/** What every page of a tournament shows around its content. */
export interface TournamentFrame {
  id: string;
  slug: string;
  name: string;
  status: string;
  locale: string;
  theme: Theme;
}

export async function getTournamentFrameRow(db: Db, tournamentId: string): Promise<TournamentFrame | null> {
  const [row] = await db
    .select({
      id: tournaments.id, slug: tournaments.slug, name: tournaments.name, status: tournaments.status,
      locale: tournaments.locale, theme: tournaments.theme,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  return row ?? null;
}

export const resolveTournamentSlug = cachedQuery(
  (slug: string) => findPublicTournamentId(getDb(), slug),
  { name: 'tournaments.by_slug', tags: (slug) => [tags.slug(slug)] },
);

export const getTournamentFrame = cachedQuery(
  (tournamentId: string) => getTournamentFrameRow(getDb(), tournamentId),
  { name: 'tournaments.frame', tags: (tournamentId) => tournamentTags(tournamentId, 'core') },
);
