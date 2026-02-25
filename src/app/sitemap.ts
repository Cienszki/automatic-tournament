// src/app/sitemap.ts
// Next.js Metadata API - generates /sitemap.xml automatically.
// Fetches tournaments dynamically from Firestore so any newly created tournament
// is automatically included without any code changes.
import type { MetadataRoute } from 'next';
import { getAdminDb, ensureAdminInitialized } from '@/server/lib/admin';
import type { TournamentType, TournamentStatus } from '@/types/tournament';

const BASE_URL = 'https://dota2inhouse.pl';

// Statuses that should NOT appear in the sitemap (not publicly visible)
const EXCLUDED_STATUSES: TournamentStatus[] = ['draft'];

type PageDef = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

// Pages common to all tournament types
const COMMON_PAGES: PageDef[] = [
  { path: '',           changeFrequency: 'weekly',  priority: 1.0 }, // tournament home
  { path: '/teams',     changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/schedule',  changeFrequency: 'daily',   priority: 0.9 },
  { path: '/playoffs',  changeFrequency: 'weekly',  priority: 0.8 },
  { path: '/stats',     changeFrequency: 'weekly',  priority: 0.8 },
  { path: '/rules',     changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faq',       changeFrequency: 'monthly', priority: 0.6 },
  { path: '/news',      changeFrequency: 'weekly',  priority: 0.7 },
  { path: '/about',     changeFrequency: 'monthly', priority: 0.5 },
];

// Pages only for league-type tournaments (e.g. PDL)
const LEAGUE_PAGES: PageDef[] = [
  { path: '/divisions', changeFrequency: 'daily', priority: 0.9 },
];

// Pages only for MMR-limited tournaments (e.g. Letnia)
const MMR_PAGES: PageDef[] = [
  { path: '/groups', changeFrequency: 'daily', priority: 0.9 },
];

// Priority multiplier per status — active tournaments rank higher than archived ones
function statusPriority(status: TournamentStatus): number {
  switch (status) {
    case 'active':
    case 'registration': return 1.0;
    case 'completed':    return 0.6;
    case 'archived':     return 0.4;
    default:             return 0.5;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    const snapshot = await db.collection('tournaments').get();

    for (const doc of snapshot.docs) {
      const data = doc.data() as {
        slug?: string;
        type?: TournamentType;
        status?: TournamentStatus;
        updatedAt?: { toDate: () => Date };
        endDate?: string;
        startDate?: string;
      };

      const { slug, type, status } = data;

      // Skip tournaments without a slug or in excluded statuses
      if (!slug || !status || EXCLUDED_STATUSES.includes(status)) continue;

      // Determine last-modified date: prefer updatedAt, fall back to endDate or startDate
      const lastModified =
        data.updatedAt?.toDate() ??
        (data.endDate ? new Date(data.endDate) : null) ??
        (data.startDate ? new Date(data.startDate) : new Date());

      const mult = statusPriority(status);
      const base = `${BASE_URL}/${slug}`;

      const pages: PageDef[] = [
        ...COMMON_PAGES,
        ...(type === 'league' ? LEAGUE_PAGES : []),
        ...(type === 'mmr-limited' ? MMR_PAGES : []),
      ];

      for (const page of pages) {
        entries.push({
          url: `${base}${page.path}`,
          lastModified,
          changeFrequency: page.changeFrequency,
          priority: Math.round(page.priority * mult * 10) / 10,
        });
      }
    }
  } catch (err) {
    // If Firestore is unavailable at build time, return just the root entry.
    // This prevents a broken build — the sitemap will be regenerated at runtime.
    console.error('[sitemap] Failed to fetch tournaments from Firestore:', err);
  }

  return entries;
}
