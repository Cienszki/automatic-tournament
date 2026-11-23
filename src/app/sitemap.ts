// /sitemap.xml, generated on request from the database and kept for an hour (WP-03). It is never
// built ahead: a build reads no database. Without DATABASE_URL, or when the database cannot be
// reached, it lists only the home page and says why in the log.

import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { sitemapEntries } from '@/features/tournaments';
import { listListedTournaments } from '@/features/tournaments/queries';
import { getDb } from '@/platform/db';
import { log } from '@/platform/log';
import { siteUrl } from '@/platform/origins';

export const dynamic = 'force-dynamic';

const ONE_HOUR = 3600;

const cachedEntries = unstable_cache(
  async (baseUrl: string) => sitemapEntries(baseUrl, await listListedTournaments(getDb()), new Date()),
  ['sitemap-entries'],
  { revalidate: ONE_HOUR, tags: ['sitemap'] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl();
  if (!process.env.DATABASE_URL) {
    log.warn('sitemap.no_database', { reason: 'DATABASE_URL is not set' });
    return sitemapEntries(baseUrl, [], new Date());
  }
  try {
    return await cachedEntries(baseUrl);
  } catch (error) {
    log.error('sitemap.read_failed', { error: error instanceof Error ? error.message : String(error) });
    return sitemapEntries(baseUrl, [], new Date());
  }
}
