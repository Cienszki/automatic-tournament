// The sitemap's entries for the listed tournaments: their pages, how often they change and how
// much they matter. Pure, so the rules are tested without a database. The same pages and weights
// as the sitemap the old site generated from Firestore.

export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface ListedTournament {
  slug: string;
  formatPreset: 'league' | 'mmr-limited' | 'swiss';
  status: 'draft' | 'registration' | 'active' | 'completed' | 'archived';
  updatedAt: Date;
}

export interface SitemapEntry {
  url: string;
  /** ISO time: the entries are cached as JSON. */
  lastModified: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

interface PageDef { path: string; changeFrequency: ChangeFrequency; priority: number }

const COMMON_PAGES: PageDef[] = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/teams', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/schedule', changeFrequency: 'daily', priority: 0.9 },
  { path: '/playoffs', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/stats', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/rules', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/news', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
];
const PRESET_PAGES: Partial<Record<ListedTournament['formatPreset'], PageDef[]>> = {
  league: [{ path: '/divisions', changeFrequency: 'daily', priority: 0.9 }],
  'mmr-limited': [{ path: '/groups', changeFrequency: 'daily', priority: 0.9 }],
};

/** Running tournaments rank above finished ones. */
function statusWeight(status: ListedTournament['status']): number {
  switch (status) {
    case 'active':
    case 'registration': return 1.0;
    case 'completed': return 0.6;
    case 'archived': return 0.4;
    default: return 0.5;
  }
}

export function sitemapEntries(baseUrl: string, tournaments: readonly ListedTournament[], now: Date): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { url: baseUrl, lastModified: now.toISOString(), changeFrequency: 'monthly', priority: 0.8 },
  ];
  for (const t of tournaments) {
    if (t.status === 'draft') continue;
    const weight = statusWeight(t.status);
    for (const page of [...COMMON_PAGES, ...(PRESET_PAGES[t.formatPreset] ?? [])]) {
      entries.push({
        url: `${baseUrl}/${t.slug}${page.path}`,
        lastModified: t.updatedAt.toISOString(),
        changeFrequency: page.changeFrequency,
        priority: Math.round(page.priority * weight * 10) / 10,
      });
    }
  }
  return entries;
}
